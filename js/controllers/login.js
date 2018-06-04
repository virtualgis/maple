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
define(["dojo/dom", "dojo/dom-style", "dojo/dom-class", "dojo/query", "dojo/on", "dojo/request", "dojo/dom-construct",
		 "dijit/registry", "dojox/widget/Toaster", "dojox/mobile/TransitionEvent",
		 "maple/config/project", "maple/config/server",
		 "dojo/_base/array", "maple/helpers/auth", "maple/helpers/utils", "maple/helpers/ui",
		 "dojo/has", "maple/helpers/login",
		 "maple/helpers/WheelScrollableView"
	], function(dom, domStyle, domClass, query, on, request, domConstructor, registry, Toaster, TransitionEvent,
				project, config, array, auth, utils, ui,
				has, login){
		"use strict";

		// Display a popup
		var showToaster = function(message, type){
			var toaster = registry.byId('loginToaster');

			toaster.positionDirection = 'tc-down';
			toaster.slideDuration = 200;
			toaster.setContent(message, type, 10000);
			toaster.show();
		};

		function goingToMapView(){
			return window.location.href.indexOf("#app,map") === window.location.href.length - "#app,map".length;
		}

		function postLogin(){
			function openMap(){
	    		new TransitionEvent(dom.byId("loginForm"),{
	    			target: "app,map",
	    			transition: "slide",
	    			transitionDir: 1
	    		}).dispatch();
    		}

			function showPostLoginMessage(){
    			new TransitionEvent(dom.byId("loginForm"),{
	    			target: "app,postloginmessage",
	    			transition: "slide",
	    			transitionDir: 1
	    		}).dispatch();
    		}

			if (login.needToShowPostLoginMessage()){
				showPostLoginMessage();
			}else{
				openMap();
			}
		}

		var standBy;

		return {
			title: project.config.title,
			subtitle: project.config.subtitle,
			logo: "/config/projects/" + project.config.name + "/" + project.config.logo,
			lastUsername: auth.getLastUsername(),
			disclaimer: project.config.disclaimer,
			supportEmail: config.supportEmail,

			init: function(){
				new Toaster({id: 'loginToaster'}, dom.byId('ToasterPane'));
				standBy = registry.byId("loginStandby");

				// Check if we are redirecting to map view
				if (goingToMapView()){
					standBy.show();
					// postLogin();
				}

				if (project.config.profiles.multiple){
					domConstructor.create("label", {'for': "profileSelector", innerHTML: "Role:"}, "profileSelectorContainer");
					ui.buildRoleSelector({
						id: 'profileSelector',
						container: 'profileSelectorContainer'
					});
				}

				on(dom.byId("loginForm"), "submit", function(e){
					e.preventDefault();

					standBy.show();

					var username = dom.byId("username").value;
					var password = dom.byId("password").value;

					auth.requestNewToken({
						username: username,
						password: password
					}).then(function(json){
				    	if (json.token){
				    		// Success
			    			auth.setToken(json.token, json.expires, username, project);

							dom.byId("password").value = "";

							// Closes keyboards on touch devices
							dom.byId("btnLogin").focus();

				    		auth.setLastUsername(username);

			    			// Check if a new config profile
			    			// needs to be loaded
			    			if (project.config.profiles.multiple){
			    				var jsonConfigFile = dom.byId("profileSelector").value;

			    				if (jsonConfigFile !== project.config.loadedConfiguration){
			    					login.reloadNewConfiguration(jsonConfigFile);
			    				}else postLogin();
			    			}else postLogin();

				    		// Will hide standBy in afterDeactivate		    		
				    	}else if (json.error){
							showToaster(json.error.message, 'error');
							standBy.hide();
				    	}else{
				    		showToaster("Cannot login: please try again later.", 'error');
				    		standBy.hide();
				    	}				    	
				    }, function(err){
				    	var message = "Cannot login: please check that you are connected to the internet.";
				    	
				    	if (has("ie") <= 9){
				    		// change message and don't send a log
				    		message = "Cannot login: please use Internet Explorer 10 or higher.";
				    	}

				    	showToaster(message, 'error');
			    		standBy.hide();
				    });
				});
			},

			beforeActivate: function(){
				if (has("ie") <= 9){
					this.warningMessage.innerHTML = "Your version of Internet Explorer is not supported. Please upgrade your version of Internet Explorer to 10 or higher.";
					domClass.remove(this.warning, "hide");
				}
				if (has("chrome") == 46){
					this.warningMessage.innerHTML = "Your version of Chrome (v46) contains a <a href='https://code.google.com/p/chromium/issues/detail?id=437904' target='_blank'>bug</a> which might crash the application. Please use Internet Explorer 10 or higher.";
					domClass.remove(this.warning, "hide");
				}
			},
			
			afterActivate: function(){
				if (!goingToMapView()){
					if (this.lastUsername) dom.byId("password").focus();
					else dom.byId("username").focus();
				}
			},

			afterDeactivate: function(){
				if (standBy) standBy.hide();
			},

			login: function(e){
				on.emit(document.getElementById("loginForm"), "submit", {
			        bubbles: true,
			        cancelable: true
			    });
			},

			forgotPwd: function(e){
				new TransitionEvent(e.target,{
	    			target: "app,resetpwd",
	    			transition: "slide",
	    			transitionDir: 1
	    		}).dispatch();
			}
		};
	}
);