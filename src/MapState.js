define('MapState', [ 'mapObject', 'Util/Timeline', 'Util/Map', 'Util/PubSub' ], function (mapObject, Timeline, Map, PubSub) {
    function MapState(ruleSet, objects, timeline) {
        this.ruleSet = ruleSet;
        this.timeline = timeline;

        this.events = new PubSub();

        var hittableObjects = [ ];

        objects.forEach(function (hitObject) {
            var appearTime = ruleSet.getObjectAppearTime(hitObject);
            var disappearTime = ruleSet.getObjectDisappearTime(hitObject);

            timeline.add(MapState.HIT_OBJECT_VISIBILITY, hitObject, appearTime, disappearTime);

            // FIXME This won't work for the future
            //   ... Why not?

            mapObject.match(hitObject, {
                Slider: function (slider) {
                    var ticks = ruleSet.getSliderTicks(hitObject);
                    hittableObjects = hittableObjects.concat(ticks);
                    slider.ticks = ticks; // Temporary (I hope)

                    var ends = ruleSet.getSliderEnds(hitObject);
                    hittableObjects = hittableObjects.concat(ends);
                    slider.ends = ends; // Temporary (I hope)

                    var earliestHitTime = ruleSet.getObjectEarliestHitTime(hitObject);
                    var latestHitTime = ruleSet.getObjectLatestHitTime(hitObject);
                    timeline.add(MapState.HIT_OBJECT_HITABLE, hitObject, earliestHitTime, latestHitTime);
                    hittableObjects.push(slider);
                },
                HitCircle: function (hitCircle) {
                    var earliestHitTime = ruleSet.getObjectEarliestHitTime(hitObject);
                    var latestHitTime = ruleSet.getObjectLatestHitTime(hitObject);
                    timeline.add(MapState.HIT_OBJECT_HITABLE, hitObject, earliestHitTime, latestHitTime);
                    hittableObjects.push(hitCircle);
                }
            });
        });

        this.unhitObjects = hittableObjects.map(function (hitObject) {
            return [ hitObject, ruleSet.getObjectLatestHitTime(hitObject) ];
        }).sort(function (a, b) {
            return a[1] < b[1] ? -1 : 1;
        });
    }

    MapState.HIT_OBJECT_VISIBILITY = 'hit object visibility';
    MapState.HIT_OBJECT_HITABLE = 'hit object hitable';

    MapState.HIT_MARKER_CREATION = 'hitmarker creation';

    MapState.fromMapInfo = function (mapInfo, timeline) {
        return new MapState(mapInfo.ruleSet, mapInfo.map.objects, timeline);
    };

    MapState.prototype = {
        getVisibleObjects: function (time) {
            return this.timeline.getAllAtTime(time, MapState.HIT_OBJECT_VISIBILITY);
        },

        getHittableObjects: function (time) {
            var rawHittables = this.timeline.getAllAtTime(time, MapState.HIT_OBJECT_HITABLE);

            return rawHittables.filter(this.isObjectHittable, this);
        },

        getUnhitObjectIndex: function (object) {
            var i;

            for (i = 0; i < this.unhitObjects.length; ++i) {
                if (this.unhitObjects[i][0] === object) {
                    return i;
                }
            }

            return -1;
        },

        isObjectHittable: function (object) {
            // If the object is unhit, it's hittable
            return this.getUnhitObjectIndex(object) >= 0;
        },

        getAccuracy: function (time) {
            var hitMarkers = this.timeline.getAllInTimeRange(0, time, MapState.HIT_MARKER_CREATION);

            return this.ruleSet.getTotalAccuracy(hitMarkers);
        },

        getScore: function (time) {
            var hitMarkers = this.timeline.getAllInTimeRange(0, time, MapState.HIT_MARKER_CREATION);

            return this.ruleSet.getTotalScore(hitMarkers);
        },

        clickAt: function (x, y, time) {
            var hittableObjects = this.getHittableObjects(time);

            var i, object;
            var hitMarker;

            for (i = 0; i < hittableObjects.length; ++i) {
                object = hittableObjects[i];

                if (this.ruleSet.canHitObject(object, x, y, time)) {
                    hitMarker = new mapObject.HitMarker(
                        object,
                        time,
                        this.ruleSet.getHitScore(object, time)
                    );

                    this.applyHitMarker(hitMarker);

                    return;
                }
            }
        },

        applyHitMarkerNoRemove: function (hitMarker) {
            // Add hit marker itself to the timeline
            this.timeline.add(MapState.HIT_MARKER_CREATION, hitMarker, hitMarker.time);

            this.events.publishSync(hitMarker);
        },

        applyHitMarker: function (hitMarker, removeObject) {
            // Object is now hit; remove it from unhit objects list
            var index = this.getUnhitObjectIndex(hitMarker.hitObject);

            if (index < 0) {
                throw new Error('Bad map state; oh dear!');
            }

            this.unhitObjects.splice(index, 1);

            this.applyHitMarkerNoRemove(hitMarker);
        },

        hitSlide: function (object, mouseState) {
            if (!mapObject.match(object, { SliderTick: true, SliderEnd: true, _: false })) {
                return null;
            }

            var score;

            if (mouseState && (mouseState.left || mouseState.right)) {
                if (this.ruleSet.canHitObject(
                    object,
                    mouseState.x,
                    mouseState.y,
                    object.time
                )) {
                    // Hit
                    score = mapObject.match(object, { SliderTick: 10, SliderEnd: 30 });
                } else {
                    // Miss
                    score = 0;
                }
            } else {
                score = 0;
            }

            var hitMarker = new mapObject.HitMarker(
                object,
                object.time,
                score
            );

            object.hitMarker = hitMarker; // Temporary (I hope)

            return hitMarker;
        },

        processSlides: function (time, mouseHistory) {
            var removedUnhitObjects = [ ];

            var i;
            var unhitObject;
            var hitMarker;

            for (i = 0; i < this.unhitObjects.length; ++i) {
                unhitObject = this.unhitObjects[i];

                if (unhitObject[1] >= time) {
                    break;
                }

                hitMarker = this.hitSlide(
                    unhitObject[0],
                    mouseHistory.getDataAtTime(unhitObject[0].time)
                );

                if (hitMarker) {
                    this.applyHitMarkerNoRemove(hitMarker);

                    // We unshift because we need to remove objects in reverse
                    // order.  Else we need to keep track of index changes while
                    // removing items, which is ugly and slow.
                    removedUnhitObjects.push(i);
                }
            }

            removedUnhitObjects.forEach(function (index) {
                this.unhitObjects.splice(index, 1);
            }, this);
        },

        processMisses: function (time) {
            var i;
            var unhitObject;
            var hitMarker;

            for (i = 0; i < this.unhitObjects.length; ++i) {
                unhitObject = this.unhitObjects[i];

                if (unhitObject[1] >= time) {
                    break;
                }

                hitMarker = new mapObject.HitMarker(
                    unhitObject[0],
                    unhitObject[1] + 1,
                    0
                );

                this.applyHitMarkerNoRemove(hitMarker);
            }

            // i has the number of unhit objects which were
            // processed.  We need to remove them ourselves
            // (because we called applyHitMarkerNoRemove).
            this.unhitObjects.splice(0, i);
        }
    };

    return MapState;
});
