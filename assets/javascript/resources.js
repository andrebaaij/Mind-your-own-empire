/* global common,level,game,ui,resources:true, data */

resources = {
    list : {}
};

/**
 * [[Description]]
 * @param   {String} resourceName Name of
 * @param   {Number} level        [[Description]]
 * @returns {Object} [[Description]]
 */
resources.getResourceURI = function(resource) {
    return './assets/resources/' + resource.name + '.json';
};

resources.initialiseResource = function(resource) {
    var definition = resources.list[resource.name];

    if (typeof definition === 'undefined') {
        var resourceURI = resources.getResourceURI(resource);
        definition = common.getJSONFromURI(resourceURI);

        resources.list[resource.name] = definition;
    }

    resource.levels = definition.levels;

    return resource;
};

resources.createResource = function(resourceName, amount, x, y) {
    if (amount <= 0) {
        return;
    }

    var coordinates = common.getCoordinatesFromGrid(x, y);

    var resource = {
        id : Symbol(),
        name : resourceName,
        amount : amount,
        references : [],
        exists : true,
        x : coordinates.x,
        y : coordinates.y,
        grid : common.getGridFromGrid(x, y)
    };

    resource = resources.initialiseResource(resource);
    resource = resources.calculateResourceLevel(resource);
    level.addResource(resource);
    return resource;
};

resources.gatherResource = function(resource, amount) {
    amount = resource.amount > amount ? amount : resource.amount;
    resource.amount -= amount;

    resource = resources.calculateResourceLevel(resource);

    if (resource.level === -1) {
        resources.destroyResource(resource);
    }

    data.resources.iron += amount;
    ui.updateResources(data.resources);

    return amount;
};

resources.calculateResourceLevel = function(resource) {
    resource.level = -1;

    resource.levels.forEach(function(amount, level) {
        if(resource.amount > amount) {
            resource.level = level;
        } else {
            return;
        }
    });

    return resource;
};

resources.destroyResource = function(resource) {
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
resources.resourceExists = function(resource) {
    return resource.exists;
};

resources.findByGrid = function(grid) {
    return level.findResource(grid);
};
