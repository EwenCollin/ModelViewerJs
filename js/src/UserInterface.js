

var UserInterface = function(domElement, interaction) {
    var self = this;
    self.domElement = domElement;
    self.interaction = interaction;
    self.domTabs = self.domElement.getElementsByClassName("settings-tab");
    self.currentObject = null;
    self.currentInteractiveSkeleton = [];

    self.dom = {}
    self.domList = ["vs-flappy-power", "vs-squashy-power", "vs-alpha", "current-skeleton-display", "helper-angular-velocity", "helper-centroid", "skeleton-transform-local", "skeleton-transform-global", "scene-empty", "vs-squashy-power-value", "vs-flappy-power-value", "vs-alpha-value", "animation-dropdown", "animation-open-dropdown", "anim-speed-multiplier", "anim-speed-multiplier-value"]

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
            for (var isk in self.currentInteractiveSkeleton) {
                self.currentInteractiveSkeleton[isk].setSkeletonVisibility(self.dom["current-skeleton-display"].checked);
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
            self.currentInteractiveSkeleton = [];
            self.currentObject = null;
        });
        self.dom["animation-open-dropdown"].addEventListener("click", function() {
            self.dom["animation-dropdown"].classList.toggle("show-animation-item");
        });
        self.dom["anim-speed-multiplier"].addEventListener("change", function() {
            self.setSpeedMultiplier(self.dom["anim-speed-multiplier"].value);
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
        self.dom["helper-angular-velocity"].checked = self.currentInteractiveSkeleton[0].getHelperVisibility("angular_speed");
        self.dom["helper-centroid"].checked = self.currentInteractiveSkeleton[0].getHelperVisibility("center_of_mass");
        self.dom["current-skeleton-display"].checked = self.currentInteractiveSkeleton[0].getSkeletonVisibility();
        self.dom["vs-flappy-power"].value = self.currentInteractiveSkeleton[0].PARAMS.weights.flappy;
        self.dom["vs-squashy-power"].value = self.currentInteractiveSkeleton[0].PARAMS.weights.squashy;
        self.dom["vs-alpha"].value = self.currentInteractiveSkeleton[0].PARAMS.alpha;
        self.dom["anim-speed-multiplier"].value = self.currentInteractiveSkeleton[0].PARAMS.animationSpeedMultiplier;
        if(self.interaction.boneControls.space === "local") {
            self.dom["skeleton-transform-local"].checked = true;
        } else {
            self.dom["skeleton-transform-global"].checked = true;
        }
        self.dom["animation-dropdown"].innerHTML = "";
        var animElement = document.createElement("div");
        animElement.setAttribute("anim-index", -1);
        animElement.innerText = "None";
        animElement.classList.add("animation-item");
        self.dom["animation-dropdown"].appendChild(animElement);
        animElement.addEventListener("click", function() {
            for(var isk in self.currentInteractiveSkeleton) {
                self.currentInteractiveSkeleton[isk].setAnimation(parseInt(this.getAttribute("anim-index")));
            }
        });
        for(var anim in self.currentInteractiveSkeleton[0].PARAMS.animationClips) {
            var animElement = document.createElement("div");
            animElement.setAttribute("anim-index", anim);
            animElement.innerText = self.currentInteractiveSkeleton[0].PARAMS.animationClips[anim].name;
            animElement.classList.add("animation-item");
            self.dom["animation-dropdown"].appendChild(animElement);
            animElement.addEventListener("click", function() {
                for(var isk in self.currentInteractiveSkeleton) {
                    self.currentInteractiveSkeleton[isk].setAnimation(parseInt(this.getAttribute("anim-index")));
                }
            });
        }
    }

    self.setTransformSpace = function() {
        if (self.currentInteractiveSkeleton.length > 0) {
            if(self.dom["skeleton-transform-local"].checked) self.interaction.boneControls.setSpace("local");
            else self.interaction.boneControls.setSpace("global");
        }
    }

    self.setHelperAngularSpeedVisible = function() {
        for (var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].setHelperVisibility("angular_speed", self.dom["helper-angular-velocity"].checked);
        }
    }
    self.setHelperCentroidVisible = function() {
        for (var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].setHelperVisibility("center_of_mass", self.dom["helper-centroid"].checked);
        }
    }

    self.setSquashingPower = function(value) {
        self.dom["vs-squashy-power-value"].innerText = value;
        for (var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].PARAMS.weights.squashy = value;
        }
    }

    self.setFlappingPower = function(value) {
        self.dom["vs-flappy-power-value"].innerText = value;
        for (var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].PARAMS.weights.flappy = value;
        }
    }
    self.setSpeedAlpha = function(value) {
        self.dom["vs-alpha-value"].innerText = value;
        for (var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].PARAMS.alpha = value;
        }
    }
    self.setSpeedMultiplier = function(value) {
        self.dom["anim-speed-multiplier-value"].innerText = value;
        for (var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].PARAMS.animationSpeedMultiplier = value;
        }

    }

}
export{ UserInterface };