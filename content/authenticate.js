/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

"use strict";

function isAuthenticated () {
    const contentPath = "chrome://procon/content/",
          branch = "extensions.procon.",
          Cu = Components.utils;

    const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

    var stringBundle = Services.strings.createBundle("chrome://procon/locale/overlay.properties?" + Math.random()), // Randomize URI to work around bug 719376
        input = {value: ""},
        preferences = {},
        context = {},
        promptResult,
        pass;

    Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");

    if (preferences.hasPref(branch + "general.password")) {

        promptResult = Services.prompt.promptPassword(null,
            stringBundle.GetStringFromName("passwordPromptTitle"),
            stringBundle.GetStringFromName("passwordPrompt"),
            input,
            null,
            {value: false}); // need to pass an object for the checkbox even if hidden

        if (!promptResult) {
            return false;
        }

        pass = preferences.getPrefByType(branch + "general.password");
        Services.scriptloader.loadSubScript(contentPath + "md5.js", context, "UTF-8");

        if (input.value.length > 0 && context.hex_md5(input.value) == pass) {
            return true; 
        } else {
            return false;
        }
    }

    return true; 
}
