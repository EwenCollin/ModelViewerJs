

var UserInterface = function(domElement, interaction) {
    var self = this;
    self.domElement = domElement;
    self.interaction = interaction;
    self.domTabs = self.domElement.getElementsByClassName("settings-tab");
    self.currentObject = null;
    self.currentInteractiveSkeleton = null;

    self.dom = {}
    self.domList = ["vs-flappy-power", "vs-squashy-power", "vs-alpha", "current-skeleton-display", "helper-angular-velocity", "helper-centroid", "skeleton-transform-local", "skeleton-transform-global", "scene-empty"]

    self.init = function() {
        for(var d in self.domList) {
            self.dom[self.domList[d]] = document.getElementById(self.domList[d]);
        }
        for(var tab = 0; tab < self.domTabs.length; tab++) {
            self.domTabs[tab].children[1].style.display = "none";
            self.domTabs[tab].children[0].addEventListener("click", function(event) {
                if (this.parentNode.children[1].style.display == "none") this.parentNode.children[1].style.display = "block";
                else this.parentNode.children[1].style.display = "none";
            });
        }

        self.dom["vs-flappy-power"].addEventListener("change", function() {
            self.setFlappingPower(self.dom["vs-flappy-power"].value);
        });
        self.dom["vs-squashy-power"].addEventListener("change", function() {
            self.setSquashingPower(self.dom["vs-squashy-power"].value);
        });
        self.dom["vs-alpha"].addEventListener("change", function() {
            self.setSpeedAlpha(self.dom["vs-alpha"].value);
        });
        self.dom["helper-angular-velocity"].addEventListener("change", function() {
            self.setHelperAngularSpeedVisible();
        });
        self.dom["helper-centroid"].addEventListener("change", function() {
            self.setHelperCentroidVisible();
        });
        self.dom["current-skeleton-display"].addEventListener("change", function() {
            if (self.currentInteractiveSkeleton != null) {
                self.currentInteractiveSkeleton.setSkeletonVisibility(self.dom["current-skeleton-display"].checked);
            }
        });
        self.dom["skeleton-transform-local"].addEventListener("change", function() {
            self.setTransformSpace();
        });
        self.dom["skeleton-transform-global"].addEventListener("change", function() {
            self.setTransformSpace();
        });
        self.dom["scene-empty"].addEventListener("click", function() {
            self.interaction.deleteAll();
            self.currentInteractiveSkeleton = null;
            self.currentObject = null;
        });
    }

    self.setCurrentObject = function(object) {
        self.currentObject = object;
    }

    self.setCurrentInteractiveSkeleton = function(interactiveSkeleton) {
        self.currentInteractiveSkeleton = interactiveSkeleton;
        self.updateUIFromInteractiveSkeleton();
    }

    self.updateUIFromInteractiveSkeleton = function() {
        self.dom["helper-angular-velocity"].checked = self.currentInteractiveSkeleton.getHelperVisibility("angular_speed");
        self.dom["helper-centroid"].checked = self.currentInteractiveSkeleton.getHelperVisibility("center_of_mass");
        self.dom["current-skeleton-display"].checked = self.currentInteractiveSkeleton.getSkeletonVisibility();
        self.dom["vs-flappy-power"].value = self.currentInteractiveSkeleton.PARAMS.weights.flappy;
        self.dom["vs-squashy-power"].value = self.currentInteractiveSkeleton.PARAMS.weights.squashy;
        self.dom["vs-alpha"].value = self.currentInteractiveSkeleton.PARAMS.alpha;
        if(self.interaction.boneControls.space === "local") {
            self.dom["skeleton-transform-local"].checked = true;
        } else {
            self.dom["skeleton-transform-global"].checked = true;
        }
    }

    self.setTransformSpace = function() {
        if (self.currentInteractiveSkeleton != null) {
            if(self.dom["skeleton-transform-local"].checked) self.interaction.boneControls.setSpace("local");
            else self.interaction.boneControls.setSpace("global");
        }
    }

    self.setHelperAngularSpeedVisible = function() {
        if(self.currentInteractiveSkeleton != null) {
            self.currentInteractiveSkeleton.setHelperVisibility("angular_speed", self.dom["helper-angular-velocity"].checked);
        }
    }
    self.setHelperCentroidVisible = function() {
        if(self.currentInteractiveSkeleton != null) {
            self.currentInteractiveSkeleton.setHelperVisibility("center_of_mass", self.dom["helper-centroid"].checked);
        }
    }

    self.setSquashingPower = function(value) {
        if(self.currentInteractiveSkeleton != null) {
            self.currentInteractiveSkeleton.PARAMS.weights.squashy = value;
        }
    }

    self.setFlappingPower = function(value) {
        if(self.currentInteractiveSkeleton != null) {
            self.currentInteractiveSkeleton.PARAMS.weights.flappy = value;
        }
    }
    self.setSpeedAlpha = function(value) {
        if(self.currentInteractiveSkeleton != null) {
            self.currentInteractiveSkeleton.PARAMS.alpha = value;
        }
    }

}
export{ UserInterface };