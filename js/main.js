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
require(["dojox/app/main", "maple/config/project", "maple/helpers/utils", "dojo/domReady!"],
    function(Application, project, utils){
	"use strict";
	
	// App startup

	var params = utils.getQueryParams();
	if (!params.p) params.p = "default";

	var projectName = params.p;
	var preferredConfig = params.c ? params.c + ".json" : null;

	project.init(projectName, preferredConfig).then(function(){
		// startup the application
		var appConfig = {
		    id: "maple",
		    name: "Map for Legacy Evolution",
		    description: "A modern, free and open-source web mapping application with built-in migration support for legacy Flex Viewer applications.",
		    version: "1.0",
		    loaderConfig: {
		        paths: {
		            maple: "/js"
		        }
		    },

		    dependencies: [
		        "dojox/mobile/Heading",
		        "dojox/mobile/View",
		        "dojox/mobile/TextBox",
		        "dojox/mobile/Button"
		    ],

		    controllers: [
		        "dojox/app/controllers/Load",
		        "dojox/app/controllers/Transition",
		        "dojox/app/controllers/Layout",
		        "dojox/app/controllers/HistoryHash"
		    ],

		    defaultView: "app",
		    defaultTransition: "none",

		    views: {
		        app:{
		            defaultView: "login",
		            controller: "maple/controllers/app.js",
		            views: {
		                login: {
		                    controller: "maple/controllers/login.js",
		                    template: "maple/views/login.html",
		                    dependencies: ["maple/widgets/Standby"]
		                },
		                map:{
		                    controller: "maple/controllers/map.js",
		                    template: "maple/views/map.html",
		                    dependencies: ["maple/widgets/Standby", "dojox/mobile/SimpleDialog"]
		                },
		                resetpwd:{
		                    controller: "maple/controllers/resetpwd.js",
		                    template: "maple/views/resetpwd.html"
		                },
		                postloginmessage:{
		                    controller: "maple/controllers/postloginmessage.js",
		                    template: "maple/views/postloginmessage.html"
		                }
		            }
		        }

		    }
		}

		// Public authentication, go directly to map view
		// instead of loading the login view
		if (project.config.server.authentication === "public"){
			appConfig.views.app.defaultView = 'map';
		}

		new Application(appConfig);
	});
});