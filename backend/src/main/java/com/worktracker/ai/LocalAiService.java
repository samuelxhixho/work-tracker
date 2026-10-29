package com.worktracker.ai;

import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class LocalAiService {

    public static final String MODEL =
            "qwen3:4b-instruct-2507-q4_K_M";

    private final JsonMapper jsonMapper;

    public LocalAiService(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    public Availability checkAvailability() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:11434/api/tags"))
                .timeout(Duration.ofSeconds(3))
                .GET()
                .build();

        try (HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build()) {

            HttpResponse<String> response = client.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() != 200) {
                return result(
                        "UNAVAILABLE",
                        "Ollama did not respond successfully."
                );
            }

            JsonNode root = jsonMapper.readTree(response.body());

            if (root == null || !root.path("models").isArray()) {
                return result(
                        "INVALID_RESPONSE",
                        "Ollama returned an unexpected response."
                );
            }

            for (JsonNode model : root.path("models")) {
                if (MODEL.equals(model.path("name").asText())
                        || MODEL.equals(model.path("model").asText())) {
                    return result(
                            "AVAILABLE",
                            "Ollama is reachable and the model is installed."
                    );
                }
            }

            return result(
                    "MODEL_MISSING",
                    "Ollama is reachable, but the required model is not installed."
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return result("UNAVAILABLE", "The availability check was interrupted.");
        } catch (IOException exception) {
            return result("UNAVAILABLE", "Cannot reach Ollama. Make sure it is running.");
        } catch (RuntimeException exception) {
            return result("INVALID_RESPONSE", "Could not read the Ollama response.");
        }
    }

    private Availability result(String status, String message) {
        return new Availability(status, MODEL, message);
    }

    public record Availability(
            String status,
            String model,
            String message
    ) {
    }
}