package com.worktracker.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

    @GetMapping({
            "/",
            "/quests",
            "/weekly-log",
            "/history",
            "/settings"
    })
    public String forwardAngularRoutes() {
        return "forward:/index.html";
    }
}