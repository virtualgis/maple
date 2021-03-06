define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/dom-class',
    'dojo/dom-style',
    'dojo/dom-attr',
    'dojo/fx',
    'dojo/html',
    'dijit/Menu',
    'dijit/MenuItem',
    'dojo/topic',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dojo/text!./templates/Sublayer.html',
    'dojo/i18n!./../nls/resource',
    'maple/helpers/utils',
    'maple/helpers/map/layers'
], function (
        declare,
        lang,
        array,
        on,
        domClass,
        domStyle,
        domAttr,
        fx,
        html,
        Menu,
        MenuItem,
        topic,
        WidgetBase,
        TemplatedMixin,
        sublayerTemplate,
        i18n,
        utils,
        mapLayers
        ) {
    var _DynamicSublayer = declare([WidgetBase, TemplatedMixin], {
        control: null,
        sublayerInfo: null,
        menu: null,
        icons: null,
        // ^args
        templateString: sublayerTemplate,
        i18n: i18n,
        _expandClickHandler: null,
        postCreate: function () {
            this.inherited(arguments);
            var checkNode = this.checkNode;
            domAttr.set(checkNode, 'data-sublayer-id', this.sublayerInfo.id);
            domClass.add(checkNode, utils.cssSafe(this.control.layer.id) + '-layerControlSublayerCheck');
            if (array.indexOf(this.control.layer.visibleLayers, this.sublayerInfo.id) !== -1) {
                this._setSublayerCheckbox(true, checkNode);
            } else {

                this._setSublayerCheckbox(false, checkNode);
            }
            on(checkNode, 'click', lang.hitch(this, function () {
                if (domAttr.get(checkNode, 'data-checked') === 'checked') {
                    this._setSublayerCheckbox(false, checkNode);
                } else {
                    this._setSublayerCheckbox(true, checkNode);
                }
                this.control._setVisibleLayers();
                this._checkboxScaleRange();
            }));
            html.set(this.labelNode, this.sublayerInfo.name);

            this._expandClick();
            if (this.sublayerInfo.minScale !== 0 || this.sublayerInfo.maxScale !== 0) {
                this._checkboxScaleRange();
                this.control.layer._mapRef.on('zoom-end', lang.hitch(this, '_checkboxScaleRange'));
            }
            //set up menu
            if (this.control.controlOptions.menu &&
                    this.control.controlOptions.menu.length) {
                domClass.add(this.labelNode, 'menuLink');
                domClass.add(this.iconNode, 'menuLink');
                this.menu = new Menu({
                    contextMenuForWindow: false,
                    targetNodeIds: [this.labelNode],
                    leftClickToOpen: true
                });
                array.forEach(this.control.controlOptions.menu, lang.hitch(this, '_addMenuItem'));
                this.menu.startup();
            }

            // create layer menu
            // this.menuClickNode.dojoClick = false;
            // this.layerMenu = new Menu({
            //     contextMenuForWindow: false,
            //     targetNodeIds: [this.menuNode],
            //     leftClickToOpen: true
            // });
            // var zoomTo = new MenuItem({
            //     label: "Zoom To",
            //     onClick: function () {
            //         // TODO
            //     }
            // });
            // this.layerMenu.addChild(zoomTo);
            // this.layerMenu.startup();
            var self = this;
            on(this.menuNode, "click", function(){
                var map = self.control.layer._mapRef;
                mapLayers.querySublayerExtent(self.control.layer, self.sublayerInfo, map.spatialReference)
                    .then(function(extent){
                        map.setExtent(extent, true);
                    });
            });
        },
        _addMenuItem: function (menuItem) {
            //create the menu item
            var item  = new MenuItem(menuItem);
            item.set('onClick', lang.hitch(this, function () {
                    topic.publish('LayerControl/' + menuItem.topic, {
                        layer: this.control.layer,
                        subLayer: this.sublayerInfo,
                        iconNode: this.iconNode,
                        menuItem: item
                    });
                }));
            this.menu.addChild(item);
        },
        // add on event to expandClickNode
        _expandClick: function () {
            var i = this.icons;
            this._expandClickHandler = on(this.expandClickNode, 'click', lang.hitch(this, function () {
                var expandNode = this.expandNode,
                        iconNode = this.expandIconNode;
                if (domStyle.get(expandNode, 'display') === 'none') {
                    domStyle.set(expandNode, 'display', 'block');
                    domClass.replace(iconNode, i.collapse, i.expand);
                } else {
                    domStyle.set(expandNode, 'display', 'none');
                    domClass.replace(iconNode, i.expand, i.collapse);
                }
            }));
        },
        // set checkbox based on layer so it's always in sync
        _setSublayerCheckbox: function (checked, checkNode) {
            checkNode = checkNode || this.checkNode;
            var i = this.icons;
            if (checked) {
                domAttr.set(checkNode, 'data-checked', 'checked');
                domClass.replace(checkNode, i.checked, i.unchecked);
            } else {
                domAttr.set(checkNode, 'data-checked', 'unchecked');
                domClass.replace(checkNode, i.unchecked, i.checked);
            }
        },
        // check scales and add/remove disabled classes from checkbox
        _checkboxScaleRange: function () {
            var node = this.checkNode,
                    scale = this.control.layer._mapRef.getScale(),
                    min = this.sublayerInfo.minScale,
                    max = this.sublayerInfo.maxScale;
            domClass.remove(node, 'layerControlCheckIconOutScale');
            if ((min !== 0 && scale > min) || (max !== 0 && scale < max)) {
                domClass.add(node, 'layerControlCheckIconOutScale');
            }
        }
    });
    return _DynamicSublayer;
});