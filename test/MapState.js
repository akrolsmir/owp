define([ 'assert', 'Map', 'MapState', 'RuleSet' ], function (assert, Map, MapState, RuleSet) {
    var exports = { };

    var appearTime = 1200;
    var disappearTime = 150;

    exports.testGetVisibleObjects_before = function () {
        var ruleSet = new RuleSet();
        ruleSet.approachRate = 5;

        var ms = new MapState(ruleSet, [ { time: 10000 } ]);

        assert.equal(0, ms.getVisibleObjects(0).length, '0ms');
        assert.equal(0, ms.getVisibleObjects(10000 - appearTime - 1).length, 'Just before appearance');
    };

    exports.testGetVisibleObjects_during = function () {
        var ruleSet = new RuleSet();
        ruleSet.approachRate = 5;
        ruleSet.overallDifficulty = 5;

        var ms = new MapState(ruleSet, [ { time: 10000 } ]);

        assert.equal(1, ms.getVisibleObjects(10000 - appearTime).length, 'Just at appearance');
        assert.equal(1, ms.getVisibleObjects(10000).length, 'Just at start time');
        assert.equal(1, ms.getVisibleObjects(10000 + disappearTime - 1).length, 'Just before disappearance');
    };

    exports.testGetVisibleObjects_after = function () {
        var ruleSet = new RuleSet();
        ruleSet.overallDifficulty = 5;

        var ms = new MapState(ruleSet, [ { time: 10000 } ]);

        assert.equal(0, ms.getVisibleObjects(10000 + disappearTime).length, 'Just at disappearance');
        assert.equal(0, ms.getVisibleObjects(10000 + disappearTime + 1).length, 'Just after disappearance');
        assert.equal(0, ms.getVisibleObjects(90000).length, 'Over 90000ms');
    };

    return exports;
});
