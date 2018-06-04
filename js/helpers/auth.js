/* Maple - A Modern Web Mapping Application
* 
* Copyright (C) 2018 VirtualGIS
* 
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
* 
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
* 
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>. */
define(["maple/config/server", "esri/IdentityManager", 
	"dojo/cookie", "dojo/_base/array", "dojo/_base/lang", "dojo/request"], 
	function(config, esriId, cookie, array, lang, request){
	"use strict";

		function supportsLS(){
			var mod = 'modernizr';
			try {
				localStorage.setItem(mod, mod);
				localStorage.removeItem(mod);
				return true;
			} catch(e) {
				return false;
			}
		}

		// Return only layer resources that have the server's name
		// in the URL
		function protectedResources(project){
			var result = array.filter(array.map(project.config.map.operationallayers.layer, function(layer){
						return layer.url;
					}), function(url){
						return url.indexOf(config.domain.name) !== -1;
					});
			if (result.length === 0) console.warn("No protected resources found! This might be an error.");
			return result;
		}

		var hasLoggedIn = false;
		if (config.authentication === "public") hasLoggedIn = true;

		var module = {
			// Check for log-in credentials
			initialize: function(project){
				var creds = module.getStoredCredentials();
				if (creds && creds.credentials && Object.prototype.toString.apply(creds.credentials) === "[object Array]"){
					// Log-in
					console.log("Found existing credentials");
					var expirationDate = new Date(creds.credentials[0].expires);

					if (expirationDate > (new Date())){

						// Update resources, necessary when
						// jumping between projects
						creds.credentials[0].resources = creds.credentials[1].resources = protectedResources(project);

						esriId.initialize(creds);
						hasLoggedIn = true;
					}
				}else{
					console.log("No previous credentials");
				}
			},

			safeUrl: function(url){
				// Force https in production
				return config.isDevEnv ? 
							url : 
							"https://" + window.location.hostname + url;
			},

			// Appends to a URL the token parameter as well as 
			// other GET params
			tokenizedGetUrl: function(url, params){
				if (url.indexOf("?") === -1){
					params.token = this.getCurrentToken(url);
					var list = [];
					for (var k in params) list.push(k + "=" + params[k]);
					return url + "?" + list.join("&");
				}else{
					return url;
				}
			},

			resetPassword: function(token, newPassword, additionalOpts){
				if (additionalOpts === undefined) additionalOpts = {};
				var data = lang.mixin({
					token: token,
					newPassword: newPassword
				}, additionalOpts);
				
				var url = this.safeUrl("/server/resetpwd.php");
							
				return request.post(url, {
					data: data,
					handleAs: "json"
				});	
			},

			sendResetPwdLinkTo: function(username, project){
				var url = this.safeUrl("/server/resetpwd.php");
							
				return request.post(url, {
					data: {
						username: username,
						project: project.config.name
					},
					handleAs: "json"
				});	
			},

			requestNewToken: function(opts){
				opts = lang.mixin({
					username: "",
					password: "",
					referer: window.location.protocol + "//" + window.location.hostname
				}, opts);

				return request.post(config.urls.tokenService, {
					data: {
						f: "json",
						username: opts.username,
						password: opts.password,
						expiration: config.security.token.expiration
					},
					handleAs: "json",
					// Avoid preflight request
					headers: {
						"X-Requested-With": null
					}
				});
			},

			getCurrentToken: function(forUrl){
				// Lookup esriId first
				for (var i in esriId.credentials){
					var cred = esriId.credentials[i];

					// TODO: what if token has expired?

					if (forUrl.indexOf(cred.server) !== -1 && cred.token){
						return cred.token;
					}
				}

				// Stored credentials second
				var creds = this.getStoredCredentials();
				if (creds && creds.credentials && creds.credentials.length > 0){
					return creds.credentials[0].token;
				}
				// else
				return "";
			},

			hasLoggedIn: function(){
				return hasLoggedIn;
			},

			setLastUsername: function(username){
				if (supportsLS()) localStorage.setItem("lastUsername", username);
				else cookie("lastUsername", username, {expires: 21}); // 21 days
			},

			getLastUsername: function(){
				if (supportsLS()) return localStorage.getItem("lastUsername") || "";
				else return cookie("lastUsername") || "";
			},

			logout: function(){
				this.setLastUsername("");
				esriId.destroyCredentials();
				if (supportsLS()){
					localStorage.setItem("credentials", "");
				}else{
					cookie("credentials", "", {expires: 1}); // 1 day
				}
			},

			// Use a new token
			setToken: function(token, expires, username, project){
				esriId.destroyCredentials();

				esriId.initialize({
				  serverInfos: [
					{
					  server: config.urls.webAdaptor,
					  tokenServiceUrl: config.urls.tokenService,
					  adminTokenServiceUrl: config.urls.adminTokenService,
					  shortLivedTokenValidity: 1440,
					  currentVersion: config.version,
					  hasServer: true
					},
					{
					  server: config.urls.base,
					  tokenServiceUrl: config.urls.tokenService,
					  adminTokenServiceUrl: config.urls.adminTokenService,
					  shortLivedTokenValidity: 1440,
					  currentVersion: config.version,
					  hasServer: true
					}
				  ],
				  oAuthInfos: [],
				  credentials: [
					{
					  userId: username,
					  server: config.urls.webAdaptor,
					  token: token,
					  expires: expires,
					  validity: 1440,
					  ssl: config.urls.webAdaptor.indexOf("https") === 0,
					  creationTime: (new Date()).getTime(),
					  scope: "server",
					  resources: protectedResources(project)
					},
					{
					  userId: username,
					  server: config.urls.base,
					  token: token,
					  expires: expires,
					  validity: 1440,
					  ssl: config.urls.base.indexOf("https") === 0,
					  creationTime: (new Date()).getTime(),
					  scope: "server",
					  resources: protectedResources(project)
					}
				  ]
				});

				hasLoggedIn = true;
				module.storeCredentials();
			},

			getStoredCredentials: function(){
				var crDump = "";

				if (supportsLS()){
					crDump = localStorage.getItem("credentials");
				}else{
					crDump = cookie("credentials");
				}

				if (crDump && crDump != "null" && crDump.length > 4) {
					return JSON.parse(crDump);
				}else{
					return null;
				}
			},

			storeCredentials: function(){
				if (esriId.credentials.length > 0){
					var crDump = JSON.stringify(esriId.toJson());

					// Cookie fallback
					if (supportsLS()){
						localStorage.setItem("credentials", crDump);
					}else{
						cookie("credentials", crDump, {expires: 1}); // 1 day
					}
				}
			}
		};

		return module;
	}
);