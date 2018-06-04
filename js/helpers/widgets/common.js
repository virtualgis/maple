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
define(["dojo/_base/array",
   "dijit/form/DropDownButton", "dijit/DropDownMenu", "dijit/MenuItem",
   "dojo/has", "dojo/topic", "maple/helpers/map/popup",
   "dojo/_base/Color", "maple/external/spectrum", "jquery",
   "esri/symbols/SimpleFillSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleMarkerSymbol",
   "xstyle/css!/css/spectrum.css"
], function (array,
	DropDownButton, DropDownMenu, MenuItem, has, topic, mapPopup,
	Color, spectrum, $,
	SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol) {
	"use strict";

	return {
		// Creates and populates a dropdown menu
		createDropDown: function(container, items, onclick){
			if (items.length === 0) return;
			var self = this;

			var menu = new DropDownMenu({ style: "display: none;"});
			var button = new DropDownButton({
				label: items[0].label,
				dropDown: menu
			});
			button.value = items[0].value;
			
			var onItemClicked = function(label, value){
				button.set("label", label);
				button.value = value;

				if (onclick !== undefined){
					onclick(label, value);
				}
			};

			array.forEach(items, function(item){
				var menuItem = new MenuItem({
					label: item.label,
					onClick: function(){
						if (item.onClick) item.onClick();
						onItemClicked(item.label, item.value);
					}
				});
				menu.addChild(menuItem);
			});

			menu.startup();
			button.startup();

			container.appendChild(button.domNode);

			return button;
		},

		// Zooms to a point while making sure the menu is closed
		// on mobile devices (and other quirks)
		zoomTo: function(point, map, zoomScale, popup, focusElement){
			if (has("touch")){
				topic.publish("viewer/closeMenu");
				
				// Closes keyboards on touch devices
				if (focusElement) focusElement.focus();
			}

			function _zoom(){
				map.centerAt(point)
					.then(function(){
						map.setScale(parseInt(zoomScale) || 6000)
							.then(function(){
								if (popup){
									mapPopup.show({
										map: map,
										point: point,
										title: popup.title,
										content: popup.content,
										mobileTitle: popup.mobileTitle,
										mobileContent: popup.mobileContent,
										hideZoom: true
									});
								}
							});
					});
			}
			_zoom();

			// Hack to fix a display issue https://os.masseranolabs.com//dashboard#details/bae3ded6dc673faddf89186b72d30cd4
			// on the first selection, the map does not properly center all of the times.
			// Calling centerAndShowInfoWindow again after a short delay seems to fix it.
			// It seems that something is not properly initialized, but seems ESRI's fault
			if (!this.__firstSelection){
				setTimeout(_zoom, 400);
				this.__firstSelection = true;
			}
		},

		// Creation of color pickers will be delayed
		// as not to freeze the UI
		colorPickerCreator: function(){
			var palette = [
				["#000","#444","#666","#999","#ccc","#eee","#f3f3f3","#fff"],
				["#f00","#f90","#ff0","#0f0","#0ff","#00f","#90f","#f0f"],
				["#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#cfe2f3","#d9d2e9","#ead1dc"],
				["#ea9999","#f9cb9c","#ffe599","#b6d7a8","#a2c4c9","#9fc5e8","#b4a7d6","#d5a6bd"],
				["#e06666","#f6b26b","#ffd966","#93c47d","#76a5af","#6fa8dc","#8e7cc3","#c27ba0"],
				["#c00","#e69138","#f1c232","#6aa84f","#45818e","#3d85c6","#674ea7","#a64d79"],
				["#900","#b45f06","#bf9000","#38761d","#134f5c","#0b5394","#351c75","#741b47"],
				["#600","#783f04","#7f6000","#274e13","#0c343d","#073763","#20124d","#4c1130"]
			];

			var colorPickerCount = 0;
			return function(element, onchange){
				setTimeout(function(){
					$(element).spectrum({
						showAlpha: true,
						showPalette: true,
						hideAfterPaletteSelect:true,
						palette: palette,
						change: function(color){
							// Convert to ESRI's color
							var c = color.toRgb();
							onchange(new Color([c.r, c.g, c.b, c.a]));
						}
					});
				}, colorPickerCount++ * 100);
				// Distribute calls in 100ms intervals
			};
		},

		fillStyles: [
			{label: "Solid", value: SimpleFillSymbol.STYLE_SOLID},
			{label: "Backward Diagonal", value: SimpleFillSymbol.STYLE_BACKWARD_DIAGONAL},
			{label: "Cross", value: SimpleFillSymbol.STYLE_CROSS},
			{label: "Forward Diagonal", value: SimpleFillSymbol.STYLE_FORWARD_DIAGONAL},
			{label: "Horizontal", value: SimpleFillSymbol.STYLE_HORIZONTAL},
			{label: "Vertical", value: SimpleFillSymbol.STYLE_VERTICAL}
		],

		outlineStyles: [
			{label: "Solid", value: SimpleLineSymbol.STYLE_SOLID},
			{label: "Dash", value: SimpleLineSymbol.STYLE_DASH},
			{label: "Dot", value: SimpleLineSymbol.STYLE_DOT},
			{label: "Dash Dot", value: SimpleLineSymbol.STYLE_DASHDOT},
			{label: "Dash Dot Dot", value: SimpleLineSymbol.STYLE_DASHDOTDOT}
		],

		pointStyles: [
			{label: "Circle", value: SimpleMarkerSymbol.STYLE_CIRCLE},
			{label: "Cross", value: SimpleMarkerSymbol.STYLE_CROSS},
			{label: "Diamond", value: SimpleMarkerSymbol.STYLE_DIAMOND},
			{label: "Square", value: SimpleMarkerSymbol.STYLE_SQUARE},
			{label: "X", value: SimpleMarkerSymbol.STYLE_X}
		]
	};
});