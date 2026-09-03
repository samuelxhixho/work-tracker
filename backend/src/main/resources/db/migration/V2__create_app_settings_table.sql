CREATE TABLE app_settings (
                              id BIGINT PRIMARY KEY,
                              display_name VARCHAR(80) NOT NULL,
                              contextual_messages_enabled BOOLEAN NOT NULL,
                              updated_at TIMESTAMP NOT NULL
);