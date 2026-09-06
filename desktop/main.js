const {
    app,
    BrowserWindow,
    dialog
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

    const javaExecutable =
        getJavaExecutable();

    const args = [
        '-jar',
        jarPath,

        '--server.address=127.0.0.1',

        `--server.port=${port}`,

        `--spring.datasource.url=jdbc:h2:file:${databasePath}`,

        '--spring.h2.console.enabled=false',

        `--logging.file.name=${logPath}`
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