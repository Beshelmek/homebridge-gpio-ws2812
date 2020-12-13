var Service, Characteristic;

/**
 * @module homebridge
 * @param {object} homebridge Export functions required to create a
 *                            new instance of this plugin.
 */
module.exports = function(homebridge){
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-gpio-ws2812', 'GPIO-WS2812', HTTP_NEO);
};

/**
 * Parse the config and instantiate the object.
 *
 * @summary Constructor
 * @constructor
 * @param {function} log Logging function
 * @param {object} config Your configuration object
 */
function HTTP_NEO(log, config) {

    // The logging function is required if you want your function to output
    // any information to the console in a controlled and organized manner.
    this.log = log;

    this.service                       = 'Light';
    this.name                          = config.name;

    this.pin                           = config.pin || 18;
    this.leds                          = config.leds  || 96;

    this.cache = {};
    this.cache.status = true;
    this.cache.brightness = 0;
    this.cache.hue = 0;
    this.cache.saturation = 0;

    this.log('ws281x init as user: ' + process.env.USER);

    this.ws281x = require('rpi-ws281x-native');

    this.ws281x.init(this.leds, {
        "gpioPing": this.pin
    });
}

/**
 *
 * @augments HTTP_NEO
 */
HTTP_NEO.prototype = {

    /** Required Functions **/
    identify: function(callback) {
        this.log('Identify requested!');
        callback();
    },

    getServices: function() {
        var informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Beshelmek")
            .setCharacteristic(Characteristic.Model, "homebridge-gpio-ws2812")
            .setCharacteristic(Characteristic.SerialNumber, "SP02022017");

        switch (this.service) {
            case 'Light':
                this.log('creating Lightbulb');
                var lightbulbService = new Service.Lightbulb(this.name);

                lightbulbService
                    .getCharacteristic(Characteristic.On)
                    .on('get', this.getPowerState.bind(this))
                    .on('set', this.setPowerState.bind(this));
                lightbulbService
                    .addCharacteristic(new Characteristic.Brightness())
                    .on('get', this.getBrightness.bind(this))
                    .on('set', this.setBrightness.bind(this));
                lightbulbService
                    .addCharacteristic(new Characteristic.Hue())
                    .on('get', this.getHue.bind(this))
                    .on('set', this.setHue.bind(this));
                lightbulbService
                    .addCharacteristic(new Characteristic.Saturation())
                    .on('get', this.getSaturation.bind(this))
                    .on('set', this.setSaturation.bind(this));

                return [lightbulbService];
            default:
                return [informationService];

        }
    },

    //** Custom Functions **//

    /**
     * Gets power state of lightbulb.
     *
     * @param {function} callback The callback that handles the response.
     */
    getPowerState: function(callback) {
        callback(null, this.cache.status)
    },

    /**
     * Sets the power state of the lightbulb.
     *
     * @param {function} callback The callback that handles the response.
     */
    setPowerState: function(state, callback) {
        //TODO state = true/false
        this.cache.status = true;
        callback();
    },

    /**
     * Gets brightness of lightbulb.
     *
     * @param {function} callback The callback that handles the response.
     */
    getBrightness: function(callback) {
        callback(null, this.cache.brightness);
    },

    /**
     * Sets the brightness of the lightbulb.
     *
     * @param {function} callback The callback that handles the response.
     */
    setBrightness: function(level, callback) {
        this.cache.brightness = level;
        this.ws281x.setBrightness((255 / 100) * level);
        //this._setRGB(callback);
    },

    /**
     * Gets the hue of lightbulb.
     *
     * @param {function} callback The callback that handles the response.
     */
    getHue: function(callback) {
        callback(null, this.cache.hue);
    },

    /**
     * Sets the hue of the lightbulb.
     *
     * @param {function} callback The callback that handles the response.
     */
    setHue: function(level, callback) {
        this.cache.hue = level;
        this._setRGB(callback);
    },

    /**
     * Gets the saturation of lightbulb.
     *
     * @param {function} callback The callback that handles the response.
     */
    getSaturation: function(callback) {
        callback(null, this.cache.saturation);
    },

    /**
     * Sets the saturation of the lightbulb.
     *
     * @param {number} level The saturation of the new call.
     * @param {function} callback The callback that handles the response.
     */
    setSaturation: function(level, callback) {
        this.cache.saturation = level;
        this._setRGB(callback);
    },

    /**
     * Sets the RGB value of the device based on the cached HSB values.
     *
     * @param {function} callback The callback that handles the response.
     */
    _setRGB: function(callback) {
        var rgb = this._hsvToRgb(this.cache.hue, this.cache.saturation, 255);

        var r = this._decToHex(rgb.r);
        var g = this._decToHex(rgb.g);
        var b = this._decToHex(rgb.b);

        this.log('_setRGB converting H:%s S:%s B:%s to RGB:%s (%s, %s, %s)...', this.cache.hue, this.cache.saturation, this.cache.brightness, r + g + b, rgb.r, rgb.g, rgb.b;

        var colorData = new Uint32Array(this.leds);
        colorData.fill(0);

        for (var i = 0; i < this.leds; i++) {
            colorData[i] = this._rgb2Int(rgb.r, rgb.g, rgb.b);
        }

        this.ws281x.render(colorData);

        callback();
    },

    _rgb2Int: function rgb2Int(r, g, b) {
        return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
    },

    /**
     * Converts an HSV color value to RGB. Conversion formula
     * adapted from http://stackoverflow.com/a/17243070/2061684
     * Assumes h in [0..360], and s and l in [0..100] and
     * returns r, g, and b in [0..255].
     *
     * @param   {Number}  h       The hue
     * @param   {Number}  s       The saturation
     * @param   {Number}  l       The lightness
     * @return  {Array}           The RGB representation
     */
    _hsvToRgb: function(h, s, v) {
        var r, g, b, i, f, p, q, t;

        h /= 360;
        s /= 100;
        v /= 100;

        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        var rgb = { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
        return rgb;
    },

    /**
     * Converts an RGB color value to HSL. Conversion formula
     * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
     * Assumes r, g, and b are in [0..255] and
     * returns h in [0..360], and s and l in [0..100].
     *
     * @param   {Number}  r       The red color value
     * @param   {Number}  g       The green color value
     * @param   {Number}  b       The blue color value
     * @return  {Array}           The HSL representation
     */
    _rgbToHsl: function(r, g, b){
        r /= 255;
        g /= 255;
        b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, l = (max + min) / 2;

        if(max == min){
            h = s = 0; // achromatic
        }else{
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max){
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        h *= 360; // return degrees [0..360]
        s *= 100; // return percent [0..100]
        l *= 100; // return percent [0..100]
        return [parseInt(h), parseInt(s), parseInt(l)];
    },

    /**
     * Converts a decimal number into a hexidecimal string, with optional
     * padding (default 2 characters).
     *
     * @param   {Number} d        Decimal number
     * @param   {String} padding  Padding for the string
     * @return  {String}          '0' padded hexidecimal number
     */
    _decToHex: function(d, padding) {
        var hex = Number(d).toString(16).toUpperCase();
        padding = typeof (padding) === 'undefined' || padding === null ? padding = 2 : padding;

        while (hex.length < padding) {
            hex = '0' + hex;
        }

        return hex;
    }

};
