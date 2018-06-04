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
define("maple/widgets/Standby", ["dojo/_base/declare", "dojox/widget/Standby"], 
	function(declare, dojoxStandby) {
		"use strict";
	    return declare("maple/widgets/Standby", [dojoxStandby], {
		   	color: '#A7A7AA',
		   	duration: 250,
		   	image: "/images/spinner.svg",
		   	centerIndicator: "image"
	    });
	}
);