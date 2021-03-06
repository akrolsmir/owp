define('gfx/View', [ ], function () {
    function View(mat) {
        this.mat = mat;
    }

    View.prototype.viewToGlobal = function (x, y) {
        return [ x + this.mat[0], y + this.mat[1] ];
    };

    View.prototype.playfieldToView = function (x, y) {
        return [ x - this.mat[0], y - this.mat[1] ];
    };

    View.map = new View([ 64, 56 ]);
    View.storyboard = new View([ 0, 0 ]);
    View.hud = new View([ 0, 0 ]);
    View.global = new View([ 0, 0 ]);

    return View;
});
