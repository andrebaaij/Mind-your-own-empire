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

    var resource = {
        name : resourceName,
        amount : amount,
        references : [],
        exists : true
    };
    resource = resources.initialiseResource(resource);
    resource = resources.calculateResourceLevel(resource);

    var coordinates = common.getCoordinatesFromGrid(x, y);
    resource.grid = common.getGridFromCoordinates(coordinates.x, coordinates.y);
    resource.x = coordinates.x;
    resource.y = coordinates.y;
    var references = level.addResource(resource);
    resource = resources.addReferences(resource, references);


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
    ui.updateIron(data.resources.iron);

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
    resources.removeReferences(resource);
    resource.exists = false;
    return resource;
};

resources.addReferences = function(resource, references) {
    references.forEach(function(reference) {
        resources.addReference(resource, reference.array, reference.index);
    });

    return resource;
};

resources.addReference = function(resource, array, index) {
    var reference = {
        array: array,
        index : index
    };

    resource.references.push(reference);

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

//TODO: should go in the common and also be applied to objects too?
resources.recalculateReferenceIndexes = function(array) {
    array.forEach(function(object,index) {
        if (typeof object.references !== 'undefined') {
            resources.updateReference(object, array, index+1);
        }
    });
};

resources.updateReference = function(resource, array, index) {
    resource.references.forEach(function(reference) {
        if (reference.array === array) {
            reference.index = index;
        }
    });
};

resources.removeReferences = function(resource) {
    resource.references.forEach(function(reference) {
        resources.removeReference(reference);
    });

    resource.references = [];
    return resource;
};

resources.removeReference = function(reference) {
    //Remove this reference
    reference.array.splice(reference.index-1,1);

    //Recalculate all indexes for object in the reference.
    resources.recalculateReferenceIndexes(reference.array);
};
