/*global common, level, game, ui, resources:true, data */

resources = {
    list : {}
};

/**
 * [[Description]]
 * @param   {String} resourceName Name of
 * @param   {Number} level        [[Description]]
 * @returns {Object} [[Description]]
 */
resources.getResourceURI = function (resource) {
    "use strict";
    return './assets/resources/' + resource.name + '.json';
};

resources.initialiseResource = function (resource) {
    "use strict";
    var definition = resources.list[resource.name],
        resourceURI;

    if (typeof definition === 'undefined') {
        resourceURI = resources.getResourceURI(resource);
        definition = common.getJSONFromURI(resourceURI);

        resources.list[resource.name] = definition;
    }

    resource.levels = definition.levels;

    return resource;
};

resources.createResource = function (resourceName, amount, x, y) {
    "use strict";
    if (amount <= 0) {
        return;
    }

    var coordinates = common.getCoordinatesFromGrid(x, y),
        resource = {
            id : Symbol(),
            name : resourceName,
            amount : amount,
            references : [],
            exists : true,
            x : coordinates.x,
            y : coordinates.y,
            grid : common.getGridFromGrid(x, y),
            group : undefined
        };

    resource = resources.initialiseResource(resource);
    resource = resources.calculateResourceLevel(resource);
    resource = level.addResource(resource);
    return resource;
};

resources.getGroupFromResource = function (resource) {
    "use strict";
    if (typeof resource.group === 'undefined') {
        resource = resources.addResourceToGroup(resource);
    }

    return resource.group;
};

resources.addResourceToGroup = function (resource) {
    "use strict";

    // If the resource group is already defined
    if (typeof resource.group !== 'undefined') {
        return resource;
    }

    // If the resource is still hidden, it can't belong to a group yet.
    var fogLayer = level.getChunk(resource.grid.chunk.x, resource.grid.chunk.y).layers.fog;
    if (!fogLayer.data[resource.grid.i]) {
        return;
    }

    //|lt|t|rt|
    //|lm|r|rm|     r = resource
    //|lb|b|rb|
    var lt = resources.findByGrid(common.getGridFromGrid(resource.grid.x-1,resource.grid.y-1))[0],
        t = resources.findByGrid(common.getGridFromGrid(resource.grid.x,resource.grid.y-1))[0],
        rt = resources.findByGrid(common.getGridFromGrid(resource.grid.x+1,resource.grid.y-1))[0],

        lm = resources.findByGrid(common.getGridFromGrid(resource.grid.x-1,resource.grid.y))[0][0],
        rm = resources.findByGrid(common.getGridFromGrid(resource.grid.x+1,resource.grid.y))[0],

        lb = resources.findByGrid(common.getGridFromGrid(resource.grid.x-1,resource.grid.y+1))[0],
        b = resources.findByGrid(common.getGridFromGrid(resource.grid.x,resource.grid.y+1))[0],
        rb = resources.findByGrid(common.getGridFromGrid(resource.grid.x+1,resource.grid.y+1))[0];

    var map = new Map()
    if (typeof lt !== "undefined" && lt.group !== 'undefined') {
        map.set(lt.group.id, lt.group);
    }
    if (typeof t !== "undefined" && t.group !== 'undefined' && !map.has(t.group.id)) {
        map.set(t.group.id, t.group);
    }
    if (typeof rt !== "undefined" && rt.group !== 'undefined' && !map.has(rt.group.id)) {
        map.set(rt.group.id, rt.group);
    }
    if (typeof lm !== "undefined" && lm.group !== 'undefined' && !map.has(lm.group.id)) {
        map.set(lm.group.id, lm.group);
    }
    if (typeof rm !== "undefined" && rm.group !== 'undefined' && !map.has(rm.group.id)) {
        map.set(rm.group.id, rm.group);
    }
    if (typeof lb !== "undefined" && lb.group !== 'undefined' && !map.has(lb.group.id)) {
        map.set(lb.group.id, lb.group);
    }
    if (typeof b !== "undefined" && b.group !== 'undefined' && !map.has(b.group.id)) {
        map.set(b.group.id, b.group);
    }
    if (typeof rb !== "undefined" && rb.group !== 'undefined' && !map.has(rb.group.id)) {
        map.set(rb.group.id, rb.group);
    }

    console.log(map);

    if (map.size === 0) {
        resource.group = resourceGroups.createResourceGroup();
        resourceGroups.addResource(resource, resource.group);
    } else if (map.size === 1) {
        var mapIter = myMap.entries();
        resource.group = mapIter.next().value[1];
        resourceGroups.addResource(resource, resource.group);
    } else {
        var prev_group = undefined;

        for(var m in map) {
            var group = prev_groupm.value[1];

            if (typeof prev_group !== 'undefined') {
                if (prev_group.resources.length > group.resources.length) {
                    resourceGroups.combineResourceGroup(group, prev_group)
                } else {
                    resourceGroups.combineResourceGroup(prev_group, group)
                }
            }
            prev_group = group;
        }
    }
};

resources.gatherResource = function (resource, amount) {
    "use strict";
    amount = resource.amount > amount ? amount : resource.amount;
    resource.amount -= amount;

    resource = resources.calculateResourceLevel(resource);

    if (resource.level === -1) {
        resources.destroyResource(resource);
    }

    return amount;
};

resources.calculateResourceLevel = function (resource) {
    "use strict";
    resource.level = -1;

    resource.levels.forEach(function (amount, level) {
        if (resource.amount > amount) {
            resource.level = level;
        } else {
            return;
        }
    });

    return resource;
};

resources.destroyResource = function (resource) {
    "use strict";
    // Remove references
    delete level.getChunk(resource.grid.chunk.x, resource.grid.chunk.y).resources[resource.grid.i][resource.id];
    delete level.getChunk(resource.grid.chunk.x, resource.grid.chunk.y).layers[resource.name].resources[resource.grid.i];
    resource.exists = false;
    return resource;
};

/**
 * This function returns whether the resources still exists or is destroyed
 * @param   {Object}  resource
 * @returns {Boolean} Resource exists
 */
resources.resourceExists = function (resource) {
    "use strict";
    return resource.exists;
};

resources.findByGrid = function (grid) {
    "use strict";
    var resource = level.findResource(grid);

    // If the resource is still hidden, it can't belong to a group yet.
    var fogLayer = level.getChunk(resource.grid.chunk.x, resource.grid.chunk.y).layers.fog;

    if (!fogLayer.data[resource.grid.i]) {
        return;
    }

    return resource;
};





// Resource Groups

var resourceGroups = {};

resourceGroups.createResourceGroup = function() {
    "use strict";

    var resourceGroup = {
            id : Symbol(),
            resources : [],
            gatherers : []
        };

    return resourceGroup;
}

resourceGroups.addResource = function(resource, group) {
    group.resources.push(resource);
}

resourceGroups.combineResourceGroup = function(obsolete, winner) {
    function updateResourceGroup (resource) {
        resource.resourceGroup = winner;
    }

    obsolete.resources.forEach(updateResourceGroup);
    winner.resources = winner.resources.concat(obsolete.resources);
}
