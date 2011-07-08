/*-----------------------------------------------------
  Copyright (c) 2011 Hunter Paolini.  All Rights Reserved.
  -----------------------------------------------------*/

procon.onFirefoxLoad = function(event) {
	var Prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
	Prefs = Prefs.getBranch("extensions.procon.");

	// clean unecessary prefs from previous versions
	if (Prefs.getCharPref("currentVersion") < "3.0") {
		Components.utils.import("resource://procon/houseKeeping.jsm");
		houseKeeping();
		common.updateButtonElements();
	}

	Components.utils.import("resource://procon/filter.jsm");

	// update subscriptions every 72 hours
	if (Prefs.getBoolPref("subscriptions.enabled")) {
		var date = new Date();
		var time = date.getTime() / 1000;
		var lastUpdateTime = Prefs.getIntPref("subscriptions.lastUpdateTime");
		if (((time - lastUpdateTime) / 3600) > 72) {
			Components.utils.import("resource://procon/subscriptions.jsm");
			var subscriptionsObj = new subscriptions();
			subscriptionsObj.update();
			publicObj.updatePrefs();
		}
	}

	document.addEventListener("DOMContentLoaded", contentListener, false);
	document.addEventListener("DOMContentLoaded", procon.configProtectionListener, false);
	
	if (Prefs.prefHasUserValue("general.password"))
		document.getElementById("helpSafeMode").disabled = true;
	
	try {
		Components.utils.import("resource://gre/modules/AddonManager.jsm");
		AddonManager.addAddonListener(procon.addonProtectionListener);
	} catch (ex) {}
};

procon.onFirefoxUnload = function(event) {
	Components.utils.import("resource://procon/filter.jsm");
	document.removeEventListener("DOMContentLoaded", contentListener, false);
};

procon.configProtectionListener = function (event) {
	var loc = event.target.location;
	
	if (!loc)
		return;
	
	loc = loc.href.toLowerCase();
	if(((loc == "about:config" || loc == "chrome://global/content/config.xul") && !common.authenticateUser()) || loc.indexOf("://procon/") != - 1) {
		event.target.location = "about:blank";
	}
};

procon.addonProtectionListener = {
	onUninstalling: function(addon) {
		if (addon.id == "{9D6218B8-03C7-4b91-AA43-680B305DD35C}" && !common.authenticateUser()) {
			AddonManager.getAddonByID("{9D6218B8-03C7-4b91-AA43-680B305DD35C}", function(addon) { addon.cancelUninstall(); });
		}
	},
	onDisabling: function(addon) {
		if (addon.id == "{9D6218B8-03C7-4b91-AA43-680B305DD35C}" && !common.authenticateUser()) {
			AddonManager.getAddonByID("{9D6218B8-03C7-4b91-AA43-680B305DD35C}", function(addon) { addon.userDisabled = false; });
		}
	}
}

window.addEventListener("load", procon.onFirefoxLoad, false);
window.addEventListener("unload", procon.onFirefoxUnload, false);
