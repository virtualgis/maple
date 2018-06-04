/* The MIT License (MIT)

Copyright (c) 2014 David Spriggs

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
define([
    'dojo/_base/declare',
    'dojo/_base/array',
    'dojo/_base/lang',
    'dojo/topic',
    'dojo/dom-attr',
    'dojo/dom-class',
    'dojo/dom-construct',
    'dijit/_WidgetBase',
    'dijit/_Container',
    'dijit/layout/ContentPane',
    'dijit/form/Button',
    'esri/tasks/ProjectParameters',
    'esri/config',
    'require',
    'dojo/Evented'
], function (
    declare,
    array,
    lang,
    topic,
    domAttr,
    domClass,
    domConst,
    WidgetBase,
    Container,
    ContentPane,
    Button,
    ProjectParameters,
    esriConfig,
    require,
    Evented
) {
    var LayerControl = declare([WidgetBase, Container, Evented], {
        map: null,
        addLayerQueue: [],
        icons: {
            expand: 'imicon-caret-right',
            collapse: 'imicon-caret-down',
            checked: 'imicon-checkbox-checked',
            unchecked: 'imicon-checkbox-unchecked',
            update: 'imicon-refresh',
            menu: 'imicon-caret-square-o-down',
            folder: 'imicon-caret-right',
            folderOpen: 'imicon-caret-down',
            zoomIn: 'imicon-zoom-in'
        },
        initialized: false,
        separated: false,
        overlayReorder: false,
        overlayLabel: false,
        vectorReorder: false,
        vectorLabel: false,
        noMenu: null,
        noLegend: null,
        noZoom: null,
        noTransparency: null,
        configuration: {},
        subLayerMenu: {},
        swipe: null,
        swiperButtonStyle: 'position:absolute;top:20px;left:120px;z-index:50;',
        // ^args
        baseClass: 'layerControlDijit',
        _vectorContainer: null,
        _overlayContainer: null,
        _swiper: null,
        _swipeLayerToggleHandle: null,
        _controls: {
            dynamic: './LayerControl/controls/Dynamic',
            feature: './LayerControl/controls/Feature',
            image: './LayerControl/controls/Image',
            tiled: './LayerControl/controls/Tiled',
            csv: './LayerControl/controls/CSV',
            georss: './LayerControl/controls/GeoRSS',
            wms: './LayerControl/controls/WMS',
            kml: './LayerControl/controls/KML',
            webtiled: './LayerControl/controls/WebTiled',
            imagevector: './LayerControl/controls/ImageVector',
            raster: './LayerControl/controls/Raster',
            stream: './LayerControl/controls/Stream'
        },
        constructor: function (options) {
            options = options || {};
            if (!options.map) {
                topic.publish('viewer/handleError', {
                    source: 'LayerControl',
                    error: 'map option is required'
                });
                return;
            }
        },

        initialize: function(layerInfos){
            if (this.separated) {
                var ControlContainer = declare([WidgetBase, Container]);
                // vector layer label
                if (this.vectorLabel !== false) {
                    this.addChild(new ContentPane({
                        className: 'vectorLabelContainer',
                        content: this.vectorLabel
                    }, domConst.create('div')), 'first');
                }
                // vector layer control container
                this._vectorContainer = new ControlContainer({
                    className: 'vectorLayerContainer'
                }, domConst.create('div'));
                this.addChild(this._vectorContainer, 'last');
                // overlay layer label
                if (this.overlayLabel !== false) {
                    this.addChild(new ContentPane({
                        className: 'overlayLabelContainer',
                        content: this.overlayLabel
                    }, domConst.create('div')), 'last');
                }
                // overlay layer control container
                this._overlayContainer = new ControlContainer({
                    className: 'overlayLayerContainer'
                }, domConst.create('div'));
                this.addChild(this._overlayContainer, 'last');
            } else {
                this.overlayReorder = false;
                this.vectorReorder = false;
            }

            // Add layers in queue to request list
            array.forEach(this.addLayerQueue, function(layer){
                layerInfos.push(layer);
            });
            this.addLayerQueue = [];

            this.loadLayers(layerInfos, lang.hitch(this, function(){
                this.emit("load", {});

                // Some layers might have been added while the widget
                // was being initialized
                if (this.addLayerQueue.length > 0){
                    this.loadLayers(this.addLayerQueue);
                    this.addLayerQueue = [];
                }

                this.initialized = true;
            }));
        },


        loadLayers: function(layerInfos, done){
            // load only the modules we need
            var modules = [];
            // push layer control mods
            array.forEach(layerInfos, function (layerInfo) {
                // check if control is excluded
                var controlOptions = layerInfo.controlOptions;
                if (controlOptions && controlOptions.exclude === true) {
                    return;
                }
                var mod = this._controls[layerInfo.type];
                if (mod) {
                    modules.push(mod);
                } else {
                    topic.publish('viewer/handleError', {
                        source: 'LayerControl',
                        error: 'the layer type "' + layerInfo.type + '" is not supported'
                    });
                }
            }, this);
            
            // load and go
            require(modules, lang.hitch(this, function () {
                var queue = [];
                array.forEach(layerInfos, function (layerInfo) {
                    // exclude from widget
                    var controlOptions = layerInfo.controlOptions;
                    if (controlOptions && controlOptions.exclude === true) {
                        return;
                    }
                    var control = this._controls[layerInfo.type];
                    if (control) {
                        var self = this;
                        queue.push(function(done){
                            require([control], lang.hitch(self, '_addControl', layerInfo, done));
                        });
                    }
                }, this);
                var processQueue = function(done){
                    if (queue.length > 0){
                        var next = queue.shift();
                        setTimeout(function(){
                            next(function(){
                                processQueue(done);
                            });                            
                        }, 5); // Set a timeout so that the UI doesn't freeze
                    }else{
                        if (done !== undefined) done();
                    }
                };
                processQueue(lang.hitch(this, function(){
                    this._checkReorder();
                    if (done !== undefined) done();
                }));
            }));
        },

        addLayer: function(layerInfo){
            if (!this.initialized){
                // Add to queue
                this.addLayerQueue.push(layerInfo);
            }else{
                this.loadLayers([layerInfo]);
            }
        },

        // create layer control and add to appropriate _container
        _addControl: function (layerInfo, done, LayerControl) {
            var layerControl = new LayerControl({
                controller: this,
                layer: (typeof layerInfo.layer === 'string') ? this.map.getLayer(layerInfo.layer) : layerInfo.layer, // check if we have a layer or just a layer id
                layerTitle: layerInfo.title,
                controlOptions: lang.mixin({
                    noLegend: null,
                    noZoom: null,
                    noTransparency: null,
                    swipe: null,
                    expanded: false,
                    sublayers: true,
                    menu: this.subLayerMenu[layerInfo.type]
                }, layerInfo.controlOptions)
            });
            layerControl.startup();
            if (this.separated) {
                if (layerControl._layerType === 'overlay') {
                    this._overlayContainer.addChild(layerControl, 'first');
                } else {
                    this._vectorContainer.addChild(layerControl, 'first');
                }
            } else {
                this.addChild(layerControl, 'first');
            }
            done();
        },
        // move control up in controller and layer up in map
        _moveUp: function (control) {
            var id = control.layer.id,
                node = control.domNode,
                index;
            if (this.separated){
                if (control._layerType === 'overlay') {
                    if (control.getPreviousSibling()) {
                        index = array.indexOf(this.map.layerIds, id);
                        if (index !== -1){
                            this.map.reorderLayer(id, index + 1);
                            this._overlayContainer.containerNode.insertBefore(node, node.previousSibling);
                            this._checkReorder();
                        }
                    }
                } else if (control._layerType === 'vector') {
                    if (control.getPreviousSibling()) {
                        index = array.indexOf(this.map.graphicsLayerIds, id);
                        if (index !== -1){
                            this.map.reorderLayer(id, index + 1);
                            this._vectorContainer.containerNode.insertBefore(node, node.previousSibling);
                            this._checkReorder();
                        }
                    }
                }
            }else{
                if (control.getPreviousSibling()) {
                    index = array.indexOf(this.map.layerIds, id);
                    if (index !== -1){
                        this.map.reorderLayer(id, index + 1);
                        this.containerNode.insertBefore(node, node.previousSibling);
                        this._checkReorder();
                    }
                } 
            }
        },
        // move control down in controller and layer down in map
        _moveDown: function (control) {
            var id = control.layer.id,
                node = control.domNode,
                index;
            if (this.separated){
                if (control._layerType === 'overlay') {
                    if (control.getNextSibling()) {
                        index = array.indexOf(this.map.layerIds, id);
                        if (index !== -1){
                            this.map.reorderLayer(id, index - 1);
                            this._overlayContainer.containerNode.insertBefore(node, node.nextSibling.nextSibling);
                            this._checkReorder();
                        }
                    }
                } else if (control._layerType === 'vector') {
                    if (control.getNextSibling()) {
                        index = array.indexOf(this.map.graphicsLayerIds, id);
                        if (index !== -1){
                            this.map.reorderLayer(id, index - 1);
                            this._vectorContainer.containerNode.insertBefore(node, node.nextSibling.nextSibling);
                            this._checkReorder();
                        }
                    }
                }
            }else{
                if (control.getNextSibling()) {
                    index = array.indexOf(this.map.layerIds, id);
                    this.map.reorderLayer(id, index - 1);
                    this.containerNode.insertBefore(node, node.nextSibling.nextSibling);
                    this._checkReorder();
                }
            }
        },
        // enable/disable move up/down menu items when the last or first child respectively
        _checkReorder: function () {
            if (this.separated) {
                if (this.vectorReorder) {
                    var children = this._vectorContainer.getChildren();
                    if (children.length === 0){
                        domClass.add(this._vectorContainer.domNode, "hide");
                    }else{
                        domClass.remove(this._vectorContainer.domNode, "hide");
                    }

                    array.forEach(children, function (child) {
                        if (!child.getPreviousSibling()) {
                            child._reorderUp.set('disabled', true);
                        } else {
                            child._reorderUp.set('disabled', false);
                        }
                        if (!child.getNextSibling()) {
                            child._reorderDown.set('disabled', true);
                        } else {
                            child._reorderDown.set('disabled', false);
                        }
                    }, this);
                }
                if (this.overlayReorder) {
                    array.forEach(this._overlayContainer.getChildren(), function (child) {
                        if (!child.getPreviousSibling()) {
                            child._reorderUp.set('disabled', true);
                        } else {
                            child._reorderUp.set('disabled', false);
                        }
                        if (!child.getNextSibling()) {
                            child._reorderDown.set('disabled', true);
                        } else {
                            child._reorderDown.set('disabled', false);
                        }
                    }, this);
                }
            }else{
                array.forEach(this.getChildren(), function (child) {
                    if (!child.getPreviousSibling()) {
                        child._reorderUp.set('disabled', true);
                    } else {
                        child._reorderUp.set('disabled', false);
                    }
                    if (!child.getNextSibling()) {
                        child._reorderDown.set('disabled', true);
                    } else {
                        child._reorderDown.set('disabled', false);
                    }
                }, this);
            }
        },
        // zoom to layer
        _zoomToLayer: function (layer) {
            if (layer.declaredClass === 'esri.layers.KMLLayer') {
                return;
            }

            // need to "merge" each kml layers fullExtent for project geometries

            var map = this.map;
            if (layer.spatialReference === map.spatialReference) {
                map.setExtent(layer.fullExtent ? layer.fullExtent : layer.extent, true);
            } else {
                if (esriConfig.defaults.geometryService) {
                    esriConfig.defaults.geometryService.project(lang.mixin(new ProjectParameters(), {
                        geometries: [layer.fullExtent ? layer.fullExtent : layer.extent],
                        outSR: map.spatialReference
                    }), function (r) {
                        map.setExtent(r[0], true);
                    }, function (e) {
                        topic.publish('viewer/handleError', {
                            source: 'LayerControl._zoomToLayer',
                            error: e
                        });
                    });
                } else {
                    topic.publish('viewer/handleError', {
                        source: 'LayerControl._zoomToLayer',
                        error: 'esriConfig.defaults.geometryService is not set'
                    });
                }
            }
        },
        // layer swiper
        _swipeLayer: function (layer, type) {
            if (!layer || !layer.visible) {
                return;
            }
            if (!this._swiper) {
                require(['esri/dijit/LayerSwipe'], lang.hitch(this, function (LayerSwipe) {
                    this._swiper = new LayerSwipe({
                        type: type || 'vertical',
                        map: this.map,
                        layers: [layer]
                    }, domConst.create('div', {}, this.map.id, 'first'));
                    this._swiper.startup();
                    this._swiper.disableBtn = new Button({
                        label: 'Exit Layer Swipe',
                        onClick: lang.hitch(this, '_swipeDisable')
                    }, domConst.create('div', {}, this.map.id));
                    domAttr.set(this._swiper.disableBtn.domNode, 'style', this.swiperButtonStyle);
                }));
            } else {
                this._swiper.disable();
                if (this._swipeLayerToggleHandle) {
                    this._swipeLayerToggleHandle.remove();
                }
                this._swiper.set('layers', [layer]);
                this._swiper.set('type', type);
                this._swiper.enable();
                domAttr.set(this._swiper.disableBtn.domNode, 'style', this.swiperButtonStyle);
            }
            this._swipeLayerToggleHandle = topic.subscribe('layerControl/layerToggle', lang.hitch(this, function (d) {
                if (d.id === layer.id && !d.visible) {
                    this._swipeDisable();
                }
            }));
        },
        _swipeDisable: function () {
            this._swiper.disable();
            if (this._swipeLayerToggleHandle) {
                this._swipeLayerToggleHandle.remove();
            }
            domAttr.set(this._swiper.disableBtn.domNode, 'style', 'display:none;');
        },
        // turn all layers on/off
        //   no arguments
        //   b/c controls are self aware of layer visibility change simply show/hide layers
        showAllLayers: function () {
            if (this.separated) {
                array.forEach(this._vectorContainer.getChildren(), function (child) {
                    child.layer.show();
                });
                array.forEach(this._overlayContainer.getChildren(), function (child) {
                    child.layer.show();
                });
            } else {
                array.forEach(this.getChildren(), function (child) {
                    child.layer.show();
                });
            }
        },
        hideAllLayers: function () {
            if (this.separated) {
                array.forEach(this._vectorContainer.getChildren(), function (child) {
                    child.layer.hide();
                });
                array.forEach(this._overlayContainer.getChildren(), function (child) {
                    child.layer.hide();
                });
            } else {
                array.forEach(this.getChildren(), function (child) {
                    child.layer.hide();
                });
            }
        }
    });
    return LayerControl;
});