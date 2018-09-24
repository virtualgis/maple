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
define(["dojo/dom", "dojo/dom-class", "dojo/query", "dojo/on", "dojo/request",
		 "dojox/mobile/TransitionEvent",
		 "maple/config/project",
		 "dojo/_base/array", "maple/helpers/utils",
		 "maple/helpers/auth", "dijit/registry"
	], function(dom, domClass, query, on, request, TransitionEvent,
				project, array, utils, auth, registry){
		"use strict";
		var standBy;

		return {
			lastUsername: auth.getLastUsername(),

			init: function(){
				standBy = registry.byId("loginStandby");
			},

			beforeActivate: function(){
				domClass.add(this.success, "hide");
				domClass.remove(this.usernameForm, "hide");

				var params = utils.getQueryParams();
				if (params.token && params.expires){
					domClass.add(this.usernameForm, "hide");
					domClass.remove(this.newPasswordForm, "hide");
					query(".mblToolBarButton").addClass('hide');

					var now = new Date().getTime();
					if (now >= parseInt(params.expires) * 1000){
						// Expired
						location.href = "/?p=" + params.p + "&err=expired" + window.location.hash;
					}
				}else if (params.err){
					this.showError("Your link has expired. Please fill the form again.");
				}

				// Hide errors on click
				var self = this;
				on(this.domNode, "click", function(){
					domClass.add(self.error, "hide");
				});  
			},

			showError: function(err){
				this.errorMessage.innerHTML = err;			
				domClass.remove(this.error, "hide");
				standBy.hide();
			},

			btnContinuePressed: function(e){
				e.preventDefault();
				e.stopPropagation();

				var self = this;
				var username = this.resetUsername.value;

				standBy.show();

				if (username != ""){
					auth.sendResetPwdLinkTo(username, project)
						.then(function(json){
							if (json.success){
								self.success.innerHTML = "If the username was valid, an e-mail will be sent to the address associated with your account.<br/><br/>Please follow the instructions provided in the e-mail to reset your password. If the e-mail does not appear in your inbox, please check your spam folder.";
								domClass.remove(self.success, "hide");
								domClass.add(self.usernameForm, "hide");

								standBy.hide();
							}else if (json.msg){
								self.showError(json.msg);
							}
						}, function(){
							self.showError("Can't proceed with password reset. Please try again later or contact support.");
						});
				}else{
					self.showError("Please type a username.");
				}
			},

			btnChangePasswordPressed: function(e){
				e.preventDefault();
				e.stopPropagation();

				var newPassword = this.newPassword.value;
				var confirmNewPassword = this.confirmNewPassword.value;
				var params = utils.getQueryParams();

				if (newPassword == ""){
					this.showError("You need to type a password.");
					return;
				}
				if (newPassword !== confirmNewPassword){
					this.showError("The two passwords are not equal. Please make sure they are identical.");
					return;
				}
				if (newPassword.length < 7){
					this.showError("The password must be longer than 7 characters.");
					return;
				}
				var self = this;
				standBy.show();
				auth.resetPassword(params.token, newPassword, {projectName: project.config.name})
					.then(function(json){
						if (json.success){
							self.success.innerHTML = "Your password has been changed.<br/><br/>You can now go back to the <a href='/?p=" + params.p + "'>login page</a>.";
							domClass.remove(self.success, "hide");
							domClass.add(self.newPasswordForm, "hide");

							standBy.hide();
						}else if (json.msg){
							self.showError(json.msg);
						}
						standBy.hide();
					}, function(){
						standBy.hide();
						self.showError("Can't proceed with password reset. Please try again later or contact support.");
					});
			}
		};
	}
);