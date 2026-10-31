const {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    shell
} = require('electron');

const {
    spawn
} = require('child_process');

const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const startupStartedAt = Date.now();

function logStartupStep(step) {
    console.log(
        `[Startup] ${step}: ${Date.now() - startupStartedAt} ms`
    );
}

const workTrackerUserDataPath =
    path.join(
        app.getPath('appData'),
        'WorkTracker'
    );

app.setPath(
    'userData',
    workTrackerUserDataPath
);

let splashWindow = null;
let mainWindow = null;
let backendProcess = null;
let backendPort = null;

const gotSingleInstanceLock =
    app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (!mainWindow) {
            return;
        }

        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }

        mainWindow.focus();
    });
}

function findAvailablePort(
    startPort = 47831
) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();

        server.unref();

        server.on('error', error => {
            if (error.code === 'EADDRINUSE') {
                resolve(
                    findAvailablePort(startPort + 1)
                );

                return;
            }

            reject(error);
        });

        server.listen(
            startPort,
            '127.0.0.1',
            () => {
                const port =
                    server.address().port;

                server.close(() => {
                    resolve(port);
                });
            }
        );
    });
}

function getJarPath() {
    if (app.isPackaged) {
        return path.join(
            process.resourcesPath,
            'backend',
            'backend-0.0.1-SNAPSHOT.jar'
        );
    }

    return path.resolve(
        __dirname,
        '..',
        'backend',
        'target',
        'extracted',
        'backend-0.0.1-SNAPSHOT.jar'
    );
}

function getJavaExecutable() {
    if (app.isPackaged) {
        return path.join(
            process.resourcesPath,
            'runtime',
            'bin',
            'javaw.exe'
        );
    }

    return path.join(
        __dirname,
        'runtime',
        'bin',
        'java.exe'
    );
}

function checkLocalAiDependencies() {
    return new Promise(resolve => {
        const unavailable = {
            ollamaRunning: false,
            modelInstalled: false
        };

        const request = http.get({
            hostname: '127.0.0.1',
            port: 11434,
            path: '/api/tags',
            timeout: 3000
        }, response => {
            if (response.statusCode !== 200) {
                response.resume();
                resolve(unavailable);
                return;
            }

            let body = '';

            response.setEncoding('utf8');

            response.on('data', chunk => {
                body += chunk;

                if (body.length > 1024 * 1024) {
                    request.destroy();
                    resolve(unavailable);
                }
            });

            response.on('error', () => resolve(unavailable));

            response.on('end', () => {
                try {
                    const result = JSON.parse(body);

                    if (!Array.isArray(result.models)) {
                        resolve(unavailable);
                        return;
                    }

                    const requiredModel =
                        'qwen3:4b-instruct-2507-q4_K_M';

                    const modelInstalled = result.models.some(model => {
                        const name = model.name ?? model.model;

                        return typeof name === 'string'
                            && name.toLowerCase() === requiredModel.toLowerCase();
                    });

                    resolve({
                        ollamaRunning: true,
                        modelInstalled
                    });
                } catch {
                    resolve(unavailable);
                }
            });
        });

        request.on('timeout', () => request.destroy());
        request.on('error', () => resolve(unavailable));
    });
}

function findInstalledOllamaExecutable() {
    const candidates = [];

    if (process.env.LOCALAPPDATA) {
        candidates.push(path.join(
            process.env.LOCALAPPDATA,
            'Programs',
            'Ollama',
            'ollama.exe'
        ));
    }

    const pathEntries = (
        process.env.Path ??
        process.env.PATH ??
        ''
    ).split(path.delimiter);

    for (const entry of pathEntries) {
        if (entry.trim()) {
            candidates.push(path.join(
                entry.trim().replace(/^"|"$/g, ''),
                'ollama.exe'
            ));
        }
    }

    return candidates.find(candidate =>
        fs.existsSync(candidate)
    ) ?? null;
}

async function promptToStartExistingOllama(executable) {
    const current = await checkLocalAiDependencies();

    if (current.ollamaRunning) {
        return true;
    }

    const appExecutable = path.join(
        path.dirname(executable),
        'ollama app.exe'
    );

    if (!fs.existsSync(appExecutable)) {
        await dialog.showMessageBox({
            type: 'warning',
            title: 'WorkTracker AI Setup',
            message: 'Ollama desktop application was not found.',
            detail: 'Please start Ollama manually, then retry AI setup.',
            buttons: ['OK']
        });

        return false;
    }

    const { response } = await dialog.showMessageBox({
        type: 'question',
        title: 'WorkTracker AI Setup',
        message: 'Ollama is installed but not running.',
        detail: 'Start the existing Ollama desktop application? No files will be downloaded.',
        buttons: ['Start Ollama', 'Not now'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    });

    if (response !== 0) {
        return false;
    }

    try {
        const launchError = await shell.openPath(appExecutable);

        if (launchError) {
            throw new Error(launchError);
        }
    } catch (error) {
        console.error('[AI setup] Ollama launch failed:', error);

        await dialog.showMessageBox({
            type: 'error',
            title: 'Ollama could not start',
            message: 'WorkTracker could not launch Ollama.',
            detail: 'Please start Ollama manually and retry AI setup.',
            buttons: ['OK']
        });

        return false;
    }

    for (let attempt = 0; attempt < 30; attempt++) {
        const status = await checkLocalAiDependencies();

        if (status.ollamaRunning) {
            console.log('[AI setup] Ollama is now running.');
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    await dialog.showMessageBox({
        type: 'warning',
        title: 'Ollama not ready',
        message: 'Ollama launched, but its server is not responding.',
        detail: 'Check the Ollama application or its logs in %LOCALAPPDATA%\\Ollama, then retry.',
        buttons: ['OK']
    });

    return false;
}

async function promptToDownloadQwen() {
    const model = 'qwen3:4b-instruct-2507-q4_K_M';
    const existing = await checkLocalAiDependencies();

    if (!existing.ollamaRunning) {
        return false;
    }

    if (existing.modelInstalled) {
        console.log('[AI setup] Qwen already installed. Skipping download.');
        return true;
    }

    const { response } = await dialog.showMessageBox({
        type: 'question',
        title: 'WorkTracker AI Setup',
        message: 'The Qwen AI model is missing.',
        detail: 'Download the required Qwen3 4B model (approximately 2.5 GB)? You can do this later.',
        buttons: ['Download Qwen', 'Later'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    });

    if (response !== 0) {
        return false;
    }

    const progressWindow = new BrowserWindow({
        width: 460,
        height: 190,
        title: 'WorkTracker AI Download',
        resizable: false,
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
        backgroundColor: '#101b28',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    const html = `
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {
                    background: #101b28;
                    color: #f4f0e8;
                    font: 14px Arial, sans-serif;
                    padding: 20px;
                }
                h3 { margin: 0 0 14px; }
                #status { margin-bottom: 16px; color: #b4c2d0; }
                #track {
                    height: 12px;
                    background: #273747;
                    border-radius: 8px;
                    overflow: hidden;
                }
                #bar {
                    height: 100%;
                    width: 0%;
                    background: #e5a15c;
                }
            </style>
        </head>
        <body>
            <h3>Installing local AI</h3>
            <div id="status">Preparing Qwen download...</div>
            <div id="track"><div id="bar"></div></div>
        </body>
        </html>
    `;

    await progressWindow.loadURL(
        'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    );

    let cancelled = false;
    let failure = '';

    const completed = await new Promise(resolve => {
        let settled = false;
        let request;
        let lastUpdate = '';

        const finish = success => {
            if (settled) {
                return;
            }

            settled = true;

            if (!progressWindow.isDestroyed()) {
                progressWindow.close();
            }

            resolve(success);
        };

        const update = (status, percent = null) => {
            if (progressWindow.isDestroyed()) {
                return;
            }

            const value = percent === null
                ? null
                : Math.max(0, Math.min(100, Math.round(percent)));

            const label = value === null
                ? status
                : `${status} - ${value}%`;

            if (label === lastUpdate) {
                return;
            }

            lastUpdate = label;

            progressWindow.setTitle(label);
            progressWindow.setProgressBar(
                value === null ? 2 : value / 100
            );

            progressWindow.webContents.executeJavaScript(`
                document.getElementById('status').textContent =
                    ${JSON.stringify(label)};
                document.getElementById('bar').style.width =
                    ${JSON.stringify(value === null ? '0%' : `${value}%`)};
            `).catch(() => {});
        };

        progressWindow.on('closed', () => {
            if (!settled) {
                cancelled = true;
                request?.destroy();
                finish(false);
            }
        });

        request = http.request({
            hostname: '127.0.0.1',
            port: 11434,
            path: '/api/pull',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, response => {
            if (response.statusCode !== 200) {
                failure = `Ollama returned HTTP ${response.statusCode}`;
                response.resume();
                finish(false);
                return;
            }

            let buffer = '';
            let successful = false;

            response.setEncoding('utf8');

            response.on('data', chunk => {
                buffer += chunk;

                if (buffer.length > 1024 * 1024) {
                    failure = 'Invalid download response.';
                    request.destroy();
                    return;
                }

                let newline;

                while ((newline = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, newline).trim();
                    buffer = buffer.slice(newline + 1);

                    if (!line) {
                        continue;
                    }

                    let progress;

                    try {
                        progress = JSON.parse(line);
                    } catch {
                        failure = 'Invalid model download progress.';
                        request.destroy();
                        return;
                    }

                    if (progress.error) {
                        failure = String(progress.error);
                        request.destroy();
                        return;
                    }

                    if (progress.status === 'success') {
                        successful = true;
                        update('Download complete', 100);
                    } else if (progress.total > 0) {
                        update(
                            'Downloading Qwen',
                            (progress.completed / progress.total) * 100
                        );
                    } else {
                        update(progress.status || 'Preparing download');
                    }
                }
            });

            response.on('end', async () => {
                if (!successful) {
                    failure ||= 'The download did not complete.';
                    finish(false);
                    return;
                }

                try {
                    const verified = await checkLocalAiDependencies();
                    finish(verified.modelInstalled);
                } catch {
                    failure = 'Could not verify the installed model.';
                    finish(false);
                }
            });

            response.on('error', error => {
                failure ||= error.message;
                finish(false);
            });
        });

        request.setTimeout(180000, () => {
            failure = 'The download connection timed out.';
            request.destroy();
        });

        request.on('error', error => {
            failure ||= error.message;
            finish(false);
        });

        request.end(JSON.stringify({
            model,
            stream: true
        }));
    });

    if (completed) {
        await dialog.showMessageBox({
            type: 'info',
            title: 'WorkTracker AI Ready',
            message: 'Qwen is installed and ready to use.',
            buttons: ['OK']
        });
    } else if (!cancelled) {
        await dialog.showMessageBox({
            type: 'warning',
            title: 'AI Download Incomplete',
            message: 'The Qwen model could not be installed.',
            detail: failure || 'You can retry AI setup later.',
            buttons: ['OK']
        });
    }

    return completed;
}

async function checkOptionalAiSetup(force = false) {
    if (!app.isPackaged && !force) {
        return;
    }

    const setupFlag = path.join(
        process.resourcesPath,
        'ai-setup-requested.flag'
    );

    if (!force && !fs.existsSync(setupFlag)) {
        console.log('[AI setup] Optional AI setup was not selected.');
        return;
    }

    if (!force) {
        const marker = path.join(
            app.getPath('userData'),
            `ai-setup-attempted-${app.getVersion()}.flag`
        );

        if (fs.existsSync(marker)) {
            console.log('[AI setup] Initial setup was already offered.');
            return;
        }

        fs.writeFileSync(marker, '');
    }

    let status = await checkLocalAiDependencies();

    if (!status.ollamaRunning) {
        const executable = findInstalledOllamaExecutable();

        const started = executable
            ? await promptToStartExistingOllama(executable)
            : await promptToInstallOllama();

        if (!started) {
            console.log('[AI setup] Ollama setup deferred.');
            return;
        }

        status = await checkLocalAiDependencies();
    }

    if (!status.ollamaRunning) {
        console.log('[AI setup] Ollama is not available.');
        return;
    }

    if (status.modelInstalled) {
        console.log('[AI setup] All dependencies ready. No downloads needed.');
        return;
    }

    const installed = await promptToDownloadQwen();

    console.log(
        installed
            ? '[AI setup] Qwen model is ready.'
            : '[AI setup] Qwen setup deferred or incomplete.'
    );
}

async function promptToInstallOllama() {
    const { response } = await dialog.showMessageBox({
        type: 'question',
        title: 'WorkTracker AI Setup',
        message: 'Ollama is required for local AI.',
        detail: 'Ollama was not detected on this computer. Would you like to install it now?',
        buttons: ['Install Ollama', 'Not now'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    });

    if (response !== 0) {
        return false;
    }

    try {
        await shell.openExternal('https://ollama.com/download/windows');
    } catch (error) {
        console.error('[AI setup] Cannot open download page:', error);

        dialog.showErrorBox(
            'Cannot open Ollama download',
            'Visit https://ollama.com/download/windows to install Ollama.'
        );

        return false;
    }

    const { response: retry } = await dialog.showMessageBox({
        type: 'info',
        title: 'Complete Ollama Installation',
        message: 'Install Ollama using the official installer.',
        detail: 'Once installation finishes, return here and click Check Again.',
        buttons: ['Check Again', 'Later'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
    });

    if (retry !== 0) {
        return false;
    }

    const status = await checkLocalAiDependencies();

    if (status.ollamaRunning) {
        return true;
    }

    const executable = findInstalledOllamaExecutable();

    if (executable) {
        return await promptToStartExistingOllama(executable);
    }

    await dialog.showMessageBox({
        type: 'warning',
        title: 'Ollama Not Detected',
        message: 'Ollama is still not available.',
        detail: 'Complete its installation and retry AI setup later.',
        buttons: ['OK']
    });

    return false;
}

let aiSetupPromise = null;

function runOptionalAiSetup(force = false) {
    if (aiSetupPromise) {
        return aiSetupPromise;
    }

    aiSetupPromise = checkOptionalAiSetup(force)
        .finally(() => {
            aiSetupPromise = null;
        });

    return aiSetupPromise;
}

ipcMain.handle('worktracker:setup-local-ai', async event => {
    const contents = mainWindow?.webContents;

    if (
        !contents ||
        event.sender !== contents ||
        event.senderFrame !== contents.mainFrame
    ) {
        throw new Error('Unauthorized AI setup request.');
    }

    const source = new URL(event.senderFrame.url);

    if (
        source.protocol !== 'http:' ||
        source.hostname !== '127.0.0.1' ||
        source.port !== String(backendPort)
    ) {
        throw new Error('AI setup is available only inside WorkTracker.');
    }

    await runOptionalAiSetup(true);

    return checkLocalAiDependencies();
});

function startBackend(port) {
    const jarPath = getJarPath();

    if (!fs.existsSync(jarPath)) {
        throw new Error(
            `Spring Boot JAR not found:\n${jarPath}`
        );
    }

    const userDataDirectory =
        app.getPath('userData');

    const dataDirectory =
        path.join(
            userDataDirectory,
            'data'
        );

    const logsDirectory =
        path.join(
            userDataDirectory,
            'logs'
        );

    const musicDirectory =
        path.join(
            userDataDirectory,
            'media',
            'music'
        );

    fs.mkdirSync(
        dataDirectory,
        {
            recursive: true
        }
    );

    fs.mkdirSync(
        logsDirectory,
        {
            recursive: true
        }
    );

    fs.mkdirSync(
        musicDirectory,
        {
            recursive: true
        }
    );

    const databasePath =
        path.join(
            dataDirectory,
            'worktracker'
        )
            .replace(/\\/g, '/');

    const logPath =
        path.join(
            logsDirectory,
            'worktracker.log'
        )
            .replace(/\\/g, '/');

    const musicPath =
        musicDirectory
            .replace(/\\/g, '/');

    const javaExecutable =
        getJavaExecutable();

    const args = [
        '-jar',
        jarPath,

        '--server.address=127.0.0.1',

        `--server.port=${port}`,

        `--spring.datasource.url=jdbc:h2:file:${databasePath}`,

        '--spring.h2.console.enabled=false',

        `--logging.file.name=${logPath}`,

        `--worktracker.media.music-directory=${musicPath}`
    ];

    backendProcess = spawn(
        javaExecutable,
        args,
        {
            windowsHide: true,
            stdio: 'ignore'
        }
    );

    backendProcess.on(
        'error',
        error => {
            console.error(
                'Backend process failed:',
                error
            );
        }
    );

    backendProcess.on(
        'exit',
        code => {
            backendProcess = null;

            if (
                !app.isQuitting &&
                code !== 0
            ) {
                console.error(
                    `Backend exited with code ${code}`
                );
            }
        }
    );
}

function waitForBackend(
    port,
    attempts = 60
) {
    return new Promise(
        (resolve, reject) => {
            let remainingAttempts =
                attempts;

            const check = () => {
                const request = http.get(
                    {
                        hostname: '127.0.0.1',
                        port,
                        path: '/',
                        timeout: 1000
                    },
                    response => {
                        response.resume();

                        if (
                            response.statusCode &&
                            response.statusCode < 500
                        ) {
                            resolve();
                            return;
                        }

                        retry();
                    }
                );

                request.on(
                    'error',
                    retry
                );

                request.on(
                    'timeout',
                    () => {
                        request.destroy();
                        retry();
                    }
                );
            };

            const retry = () => {
                remainingAttempts--;

                if (
                    remainingAttempts <= 0
                ) {
                    reject(
                        new Error(
                            'WorkTracker backend did not start in time.'
                        )
                    );

                    return;
                }

                setTimeout(
                    check,
                    100
                );
            };

            check();
        }
    );
}

function createSplashWindow() {
    splashWindow =
        new BrowserWindow({
            width: 420,
            height: 260,

            icon: path.join(
                __dirname,
                'build',
                'icon.png'
            ),

            resizable: false,
            frame: false,

            backgroundColor: '#0b1520',

            show: false,

            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });

    splashWindow.once(
        'ready-to-show',
        () => {
            logStartupStep('Splash ready to show');

            splashWindow.show();

            logStartupStep('Splash shown');
        }
    );

    splashWindow.loadFile(
        path.join(
            __dirname,
            'splash.html'
        )
    );

    splashWindow.on(
        'closed',
        () => {
            splashWindow = null;
        }
    );
}

function createWindow(port) {
    mainWindow =
        new BrowserWindow({
            width: 1440,
            height: 900,

            minWidth: 900,
            minHeight: 650,

            title: 'WorkTracker',

            icon: path.join(
                __dirname,
                'build',
                'icon.png'
            ),

            backgroundColor: '#09111a',

            autoHideMenuBar: true,

            show: false,

            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });

    mainWindow.once(
        'ready-to-show',
        () => {
            logStartupStep('Window ready to show');

            if (splashWindow) {
                splashWindow.close();
            }

            mainWindow.show();

            logStartupStep('Window shown');
        }
    );

    mainWindow.loadURL(
        `http://127.0.0.1:${port}/?startup=${Date.now()}`
    );

    mainWindow.on(
        'closed',
        () => {
            mainWindow = null;
        }
    );
}

function stopBackend() {
    if (!backendProcess) {
        return;
    }

    backendProcess.kill();
    backendProcess = null;
}

app.whenReady().then(
    async () => {
        logStartupStep('Electron app ready');

        createSplashWindow();

        try {
            backendPort =
                await findAvailablePort();

            logStartupStep('Port found');

            startBackend(
                backendPort
            );

            logStartupStep('Backend process launched');

            await waitForBackend(
                backendPort
            );

            logStartupStep('Backend reachable');

            createWindow(
                backendPort
            );

            logStartupStep('Window created');
            if (!app.isPackaged) {
                checkLocalAiDependencies().then(status => {
                    console.log('[AI setup]', {
                        ...status,
                        ollamaInstalled:
                            !!findInstalledOllamaExecutable()
                    });
                });
            }
            if (app.isPackaged) {
                runOptionalAiSetup().catch(error => {
                    console.error('[AI setup] Dependency check failed:', error);
                });
            }
        } catch (error) {
            console.error(error);

            dialog.showErrorBox(
                'WorkTracker could not start',
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            app.quit();
        }
    }
);

app.on(
    'before-quit',
    () => {
        app.isQuitting = true;

        stopBackend();
    }
);

app.on(
    'window-all-closed',
    () => {
        app.quit();
    }
);