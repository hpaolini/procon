/*-----------------------------------------------------
  Copyright (c) 2016 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

"use strict";

const Ci = Components.interfaces,
      Cc = Components.classes,
      Cr = Components.results,
      Cu = Components.utils;

const contentPath = "chrome://procon/content/",
      branch = "extensions.procon.",
      host = "procon:";
      
const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
//let console = (Cu.import("resource://gre/modules/Console.jsm", {})).console;

var rand = null;

// we used to use this as a solution to a race condition bug (http://bugzil.la/1202125)
// where an unload async message would also affect process and frame scripts of the
// newly updated add-on in non-e10s firefox. unfortunately we also load a js module,
// thus, we must take care to startup when the module has (1) not yet been imported
// or (2) just been unloaded -- if not, frame scripts endup with dead references to
// the previous module. we avoid this with a truthy constant in the module itself,
// and check for its existence in the process script
//
// function getScriptId () {
//     return rand;
// }

var ui = (function () {
    var isMobile = (Services.appinfo.ID == "{aa3c5121-dab2-40e2-81ca-7ea25febc110}"),
        {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm", {}),
        WindowListener,
        menuId,
        widget;

    var {CustomizableUI} = (!isMobile) ? Cu.import("resource:///modules/CustomizableUI.jsm", {}) : {};

    function loadIntoWindow (window) {
        if (isMobile) {
            loadIntoWindow = function (window) {
                menuId = window.NativeWindow.menu.add({
                    name: "ProCon Latte",
                    parent: window.NativeWindow.menu.toolsMenuID,
                    icon: null,
                    callback: function () {
                        window.BrowserApp.addTab(contentPath + "options.xhtml", {});
                    }
                });
            };
        } else {
            loadIntoWindow = function (window) {
                var safeModeButton = window.document.getElementById("helpSafeMode"),
                    preferences = {};
                Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");
                if (preferences.hasPref(branch + "general.password") && safeModeButton) {
                    safeModeButton.disabled = true;
                }
            };
        }
        loadIntoWindow(window);
    }

    function unloadFromWindow (window) {
        if (isMobile) {
            unloadFromWindow = function (window) {
                window.NativeWindow.menu.remove(menuId);
            };
        } else {
            unloadFromWindow = function (window) {
                var safeModeButton = window.document.getElementById("helpSafeMode");
                if (safeModeButton) {
                    safeModeButton.disabled = false;
                }
            };
        }
        unloadFromWindow(window);
    }

    function forEachOpenWindow (fn) {
        var windows = Services.wm.getEnumerator("navigator:browser");
        while (windows.hasMoreElements()) {
            fn(windows.getNext().QueryInterface(Ci.nsIDOMWindow));
        }
    }

    WindowListener = {
        onOpenWindow: function (xulWindow) {
            //var window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
            var window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
            function onWindowLoad () {
                window.removeEventListener("load", onWindowLoad);
                if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
                    loadIntoWindow(window);
                }
            }
            window.addEventListener("load", onWindowLoad);
        },
        onCloseWindow: function (xulWindow) {},
        onWindowTitleChange: function (xulWindow, newTitle) {}
    };

    widget = {
        _ss: null,
        _uri: null,
        _id: "procon-button",
        _grayscale: false,
        create: function () {
            // the 'style' directive isn't supported in chrome.manifest for bootstrapped
            // extensions, so this is the manual way of doing the same.
            this._ss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
            this._uri = Services.io.newURI("chrome://procon/skin/toolbar.css", null, null);
            this._ss.loadAndRegisterSheet(this._uri, this._ss.USER_SHEET);

            CustomizableUI.createWidget({
                id: this._id,
                defaultArea: CustomizableUI.AREA_NAVBAR,
                label: "ProCon Latte",
                tooltiptext: "ProCon Latte",
                onCommand: function(aEvent) {
                    //var browserMM = aEvent.target.ownerDocument.defaultView.gBrowser.selectedBrowser.messageManager;
                    var thisDOMWindow = aEvent.target.ownerDocument.defaultView; //this is the browser (xul) window
                    var thisWindowsSelectedTabsWindow = thisDOMWindow.gBrowser.selectedTab.linkedBrowser; //.contentWindow; //this is the html window of the currently selected tab
                    var browserMM = thisWindowsSelectedTabsWindow.messageManager;
                    browserMM.loadFrameScript("data:,content.document.location='" + contentPath + "options.xhtml';", false);
                },
                onCreated: function (button) {
                    if (widget._grayscale) {
                        button.setAttribute("style", "filter:grayscale(100%);");
                    } else {
                        button.setAttribute("style", "");
                    }
                }
            });

            this.update();
        },

        destroy: function () {
            CustomizableUI.destroyWidget(this._id);
            if (this._ss && this._ss.sheetRegistered(this._uri, this._ss.USER_SHEET)) {
                this._ss.unregisterSheet(this._uri, this._ss.USER_SHEET);
            }
        },

        update: function () {
            var blacklistSitesEnabled,
                blacklistWordsEnabled,
                blacklistEnabled,
                preferences = {},
                callback;

            Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");

            blacklistSitesEnabled = preferences.getPrefByType(branch + "blacklist.sites.enabled");
            blacklistWordsEnabled = preferences.getPrefByType(branch + "blacklist.words.enabled");
            blacklistEnabled = preferences.getPrefByType(branch + "blacklist.enabled");

            if (blacklistEnabled && (blacklistSitesEnabled || blacklistWordsEnabled)) {
                widget._grayscale = false;
                callback = function (window) {
                    CustomizableUI.getWidget("procon-button").forWindow(window).node.setAttribute("style", "");
                };
            } else {
                widget._grayscale = true;
                callback = function (window) {
                    CustomizableUI.getWidget("procon-button").forWindow(window).node.setAttribute("style", "filter:grayscale(100%);");
                };
            }

            forEachOpenWindow(callback);
        }
    };

    function prefButtonObserver (document, topic, id) {
        if (id !== "{9D6218B8-03C7-4b91-AA43-680B305DD35C}") {
            return;
        }
 
        document.getElementById("showOptionsButton").addEventListener("command",
        function (event) {
            event.target.ownerDocument.location = contentPath + "options.xhtml";
        }, true);
    }

    return {
        load: function () {
            forEachOpenWindow(loadIntoWindow);
            Services.wm.addListener(WindowListener);

            if (!isMobile) {
                Services.ppmm.addMessageListener(host + "updateWidgetStatus", widget.update);
                widget.create();
            }

            Services.obs.addObserver(prefButtonObserver, AddonManager.OPTIONS_NOTIFICATION_DISPLAYED, false);
        },

        unload: function () {
            Services.wm.removeListener(WindowListener);
            forEachOpenWindow(unloadFromWindow);

            if (!isMobile) {
                Services.ppmm.removeMessageListener(host + "updateWidgetStatus", widget.update);
                widget.destroy();
            }

            Services.obs.removeObserver(prefButtonObserver, AddonManager.OPTIONS_NOTIFICATION_DISPLAYED);
        }
    };
}());

var observer = (function () {
    var loaded = false,
        httpRequestObserver = {
            observe: function (subject, topic, data) {
                var httpChannel,
                    loadContext,
                    topFrameElement,
                    browserMM,
                    results;

                if (topic == "http-on-modify-request") {
                    httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
                    if (httpChannel.loadFlags & Ci.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) {
                        loadContext = httpChannel.notificationCallbacks.getInterface(Ci.nsILoadContext);
                        // topFrameElement is the <browser> element
                        topFrameElement = loadContext.topFrameElement;
                        browserMM = topFrameElement.messageManager;
                        results = function (msg) {
                            browserMM.removeMessageListener(host + "results", results);
                            if (msg.data.block) {
                                httpChannel.cancel(Cr.NS_BINDING_ABORTED);
                                return true;
                            }
                            return false;
                        };
                        browserMM.addMessageListener(host + "results", results);
                        // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFrameScriptLoader#loadFrameScript%28%29
                        browserMM.loadFrameScript(contentPath + "frameScript.js", false);
                        browserMM.sendAsyncMessage(host + "scan", {url: {host: httpChannel.URI.host, spec: httpChannel.URI.spec}});
                    }
                }
            }
        };

    function register () {
        if (!loaded) {
            Services.obs.addObserver(httpRequestObserver, "http-on-modify-request", false);
            loaded = true;
        }
    }

    function unregister () {
        if (loaded) {
            Services.obs.removeObserver(httpRequestObserver, "http-on-modify-request");
            loaded = false;
        }
    }

    function update () {
        var blacklistSitesEnabled,
            blacklistEnabled,
            preferences = {};

        Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");

        blacklistSitesEnabled = preferences.getPrefByType(branch + "blacklist.sites.enabled");
        blacklistEnabled = preferences.getPrefByType(branch + "blacklist.enabled");

        if (blacklistEnabled && blacklistSitesEnabled && !loaded) {
            register();
        } else if((!blacklistEnabled || !blacklistSitesEnabled) && loaded) {
            unregister();
        }
    }

    return {
        load: function () {
            Services.ppmm.addMessageListener(host + "updateObserverStatus", update);
            loaded = false;
            update();
        },

        unload: function () {
            Services.ppmm.removeMessageListener(host + "updateObserverStatus", update);
            unregister();
        }
    };
}());

function startup (data, reason) {
    var time,
        lastUpdateTime,
        preferences = {},
        isReady,
        tryDelay = 5,
        trySum = 0,
        tryMax = 30000,
        timer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer),
        checkLater,
        timerObserver,
        housekeep = {},
        subscriptions = {};

    Services.scriptloader.loadSubScript(contentPath + "preferences.js", preferences, "UTF-8");

    // we call this on startup, rather than install, because chrome scripts are not registered until after install
    if (!preferences.hasPref(branch + "firstRun") || preferences.getPrefByType(branch + "firstRun")) {
        preferences.setDefaultPref(true); // pass argument true for firstRun

        // clean deprecated prefs from legacy versions
        if (preferences.getPrefByType(branch + "currentVersion") < "3.0") {
            Services.scriptloader.loadSubScript(contentPath + "housekeep.js", housekeep, "UTF-8");
            housekeep.load();
        }

        preferences.setPrefByType(branch + "firstRun", false);
    }

    // update subscriptions every 72 hours
    if (preferences.getPrefByType(branch + "subscriptions.enabled")) {
        time = (new Date()).getTime() / 1000;
        lastUpdateTime = preferences.getPrefByType(branch + "subscriptions.lastUpdateTime");

        if (((time - lastUpdateTime) / 3600) > 72) {
            Services.scriptloader.loadSubScript(contentPath + "subscriptions.js", subscriptions, "UTF-8");
            subscriptions.load();
        }
    }

    // load this early or else the widget won't attach to the initial window
    ui.load();

    isReady = function () {
        if (Services.cpmm.sendSyncMessage(host + "isJSMLoaded", {})[0]) {
            return false;
        }

        rand = Math.random().toString().replace(/\./g, "");
        // Services.ppmm.addMessageListener(host + "getScriptId", getScriptId);
        // Services.mm.addMessageListener(host + "getScriptId", getScriptId);
        Services.ppmm.loadProcessScript(contentPath + "delayedProcessScript.js?" + rand, true); //bugzilla #1051238
        Services.mm.loadFrameScript(contentPath + "delayedFrameScript.js?" + rand, true); //bugzilla #1051238
        observer.load();

        return true;
    };

    checkLater = function () {
        trySum += tryDelay;
        if (trySum >= tryMax) {
            timer = null;
            return;
        }
        timer.init(timerObserver, tryDelay, timer.TYPE_ONE_SHOT);
        tryDelay *= 2;
        if (tryDelay > 500) {
            tryDelay = 500;
        }
    };

    timerObserver = {
        observe: function () {
            timer.cancel();
            if (isReady()) {
                timer = null;
            } else {
                checkLater();
            }
        }
    };

    checkLater();
}

function shutdown (data, reason) {
    if (reason === APP_SHUTDOWN) {
        return;
    }

    ui.unload();
    observer.unload();

    // for some reason, these objects became zombies
    // during an update testing, could not replicate
    // it always, and i'm not sure whose fault it is
    // so to be safe we'll set them to null
    ui = null;
    observer = null;

    Services.mm.removeDelayedFrameScript(contentPath + "delayedFrameScript.js?" + rand);
    Services.ppmm.removeDelayedProcessScript(contentPath + "delayedProcessScript.js?" + rand);
    Services.mm.broadcastAsyncMessage(host + "unload", {id: rand});
    Services.ppmm.broadcastAsyncMessage(host + "unload", {id: rand});
    // Services.mm.removeMessageListener(host + "getScriptId", getScriptId);
    // Services.ppmm.removeMessageListener(host + "getScriptId", getScriptId);
}

function install (data, reason) {
    Services.prefs.setBoolPref(branch + "firstRun", true);
}

function uninstall (data, reason) {
    if (reason === ADDON_UNINSTALL) {
        Services.prefs.clearUserPref("nglayout.initialpaint.delay");
    }
}
