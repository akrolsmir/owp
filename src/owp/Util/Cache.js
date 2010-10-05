exports.$ = (function () {
    var Map = require('owp/Util/Map').$;

    // TODO Actual caching

    var Cache = function () {
        this.map = new Map();
    };

    Cache.prototype = {
        get: function (key, creator) {
            var data;

            if (this.map.contains(key)) {
                data = this.map.get(key);
            } else {
                data = creator(key);
                this.map.set(key, data);
            }

            return data;
        },

        set: function (key, value) {
            this.map.set(key, value);
        }
    };

    return Cache;
}());
