/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

"use strict";

const {Services} = Components.utils.import("resource://gre/modules/Services.jsm", {});

var blocked = (function () {
    var stringBundle = Services.strings.createBundle("chrome://procon/locale/overlay.properties?" + Math.random()),
        contentPath = "chrome://procon/content/",
        branch = "extensions.procon.",
        host = "procon:",
        URI;

    function sendMessage (msg, data, callback) {
        if (!Services.scriptloader.loadSubScript(contentPath + "authenticate.js", {}, "UTF-8")) {
            alert(stringBundle.GetStringFromName("passwordPromptWrong"));
            return;
        }

        if (typeof callback === "function") {
            callback();
        }

        if (Services.cpmm.sendSyncMessage(host + msg, data)[0]) {
            location.replace(URI.spec);
        }
    }

    return {
        allowPage: function () {
            sendMessage("filterUpdate", {fn: "setWhitelistSessionPage", url: URI.spec});
        },

        allowDomain: function () {
            sendMessage("filterUpdate", {fn: "setWhitelistSessionDomain", url: URI.host});
        },

        addWhitelistSite: function () {
            var callback = function () {
                var preferences = {},
                    value;
                Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");
                value = URI.host + "\n" + preferences.getPrefByType(branch + "whitelist.sites");
                preferences.setPrefByType(branch + "whitelist.sites", value);
                if (!preferences.getPrefByType(branch + "whitelist.enabled")) {
                    alert(stringBundle.GetStringFromName("whitelistDisabled"));
                }
            };
            sendMessage("filterUpdate", {fn: "updatePrefs"}, callback);
        },

        load: function () {
            window.removeEventListener("load", blocked.load); 

            var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService),
                urlParams = JSON.parse(decodeURIComponent(escape(atob(window.location.search.substring(1, window.location.search.length))))),
                italicElement = document.createElement("i"),
                boldElement = document.createElement("b"),
                msg = document.getElementById("msg");

            boldElement.appendChild(document.createTextNode(urlParams.msg));
            italicElement.appendChild(document.createTextNode(urlParams.url));
            msg.appendChild(boldElement);
            msg.appendChild(document.createElement("br"));
            msg.appendChild(italicElement);

            if (urlParams.match.length > 0) {
                msg.appendChild(document.createElement("br"));
                msg.appendChild(document.createTextNode(urlParams.match + "…"));
            }

            URI = ioService.newURI(urlParams.url, null, null);
        }
    };
}());

window.addEventListener("load", blocked.load, false); 
