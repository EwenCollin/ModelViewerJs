import * as THREE from '../../build/three.module.js';

var UserInterface = function(domElement, interaction, loader, controls) {
    var self = this;
    self.domElement = domElement;
    self.interaction = interaction;
    self.loader = loader;
    self.domTabs = self.domElement.getElementsByClassName("settings-tab");
    self.currentObject = null;
    self.currentInteractiveSkeleton = [];
    self.selectedJoint = [];
    self.controls = controls;
    
    self.dom = {}
    self.domList = ["wp-smoothing", "wp-smoothing-value", "wp-brush-strength-value", "wp-brush-strength", "wp-brush-size", "wp-brush-size-value", "vertex-weights", "use-vertex-weights", "weight-painting", "progress", "progress-bar1", "progress-message", "background-color", "vs-flappy-power", "vs-squashy-power", "vs-alpha", "current-skeleton-display", "helper-angular-velocity", "helper-centroid", "skeleton-transform-local", "skeleton-transform-global", "scene-empty", "vs-squashy-power-value", "vs-flappy-power-value", "vs-alpha-value", "animation-dropdown", "animation-open-dropdown", "anim-speed-multiplier", "anim-speed-multiplier-value", "bone-vs-enable-all", "bone-vs-disable-all", "bone-vs-enabled", "bone-open-dropdown", "bone-dropdown", "vs-global-power", "vs-global-power-value"];

    self.init = function() {
        for(var d in self.domList) {
            self.dom[self.domList[d]] = document.getElementById(self.domList[d]);
        }
        for(var tab = 0; tab < self.domTabs.length; tab++) {
            self.domTabs[tab].children[1].style.display = "none";
            self.domTabs[tab].children[0].addEventListener("click", function(event) {
                if (this.parentNode.children[1].style.display == "none") {
                    this.parentNode.children[1].style.display = "block";
                    this.classList.add("active-tab-title");
                }
                else {
                    this.parentNode.children[1].style.display = "none";
                    this.classList.remove("active-tab-title");
                }
            });
        }

        self.dom["background-color"].addEventListener("input", function() {
            function hexToRgb(hex) {
                var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16)
                } : null;
            }

            self.interaction.scene.background = new THREE.Color(this.value);
            var rgb = hexToRgb(this.value);
            const brightness = Math.round(((parseInt(rgb.r) * 299) + (parseInt(rgb.g) * 587) + (parseInt(rgb.b) * 114)) / 1000);
            var tabs = document.getElementsByClassName("tab-content");
            if(brightness > 125) {
                for(var tab in tabs) {
                    tabs[tab].classList.remove("tab-content-dark");
                }
            } else {
                for(var tab in tabs) {
                    tabs[tab].classList.add("tab-content-dark");
                }
            }
        });

        self.dom["wp-smoothing"].addEventListener("input", function() {
            self.setWeightSmoothing(this.value);
        });

        self.dom["wp-brush-strength"].addEventListener("input", function() {
            self.setWeightBrushStrength(this.value);
        });
        self.dom["wp-brush-size"].addEventListener("input", function() {
            self.setWeightBrushSize(this.value);
        });

        self.dom["weight-painting"].addEventListener("change", function() {
            self.setWeightPainting(this.checked);
        });
        self.dom["use-vertex-weights"].addEventListener("change", function() {
            self.setUseWeightPainting(this.checked);
        });
        self.dom["vertex-weights"].addEventListener("change", function() {
            self.setDisplayVertexWeights(this.checked);
        });

        self.dom["vs-flappy-power"].addEventListener("input", function() {
            self.setFlappingPower(self.dom["vs-flappy-power"].value);
        });
        self.dom["vs-squashy-power"].addEventListener("input", function() {
            self.setSquashingPower(self.dom["vs-squashy-power"].value);
        });
        self.dom["vs-global-power"].addEventListener("input", function() {
            self.setGlobalPowerFactor(self.dom["vs-global-power"].value);
        });
        self.dom["vs-alpha"].addEventListener("input", function() {
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
            self.loader.resetObjects();
            self.currentInteractiveSkeleton = [];
            self.currentObject = null;
        });
        self.dom["animation-open-dropdown"].addEventListener("click", function() {
            self.dom["animation-dropdown"].classList.toggle("show-animation-item");
        });
        self.dom["anim-speed-multiplier"].addEventListener("input", function() {
            self.setSpeedMultiplier(self.dom["anim-speed-multiplier"].value);
        });
        self.dom["bone-open-dropdown"].addEventListener("click", function() {
            self.dom["bone-dropdown"].classList.toggle("show-animation-item");
        });
        self.dom["bone-vs-enable-all"].addEventListener("click", function() {
            self.toggleJoint(null, null, true);
        });
        self.dom["bone-vs-disable-all"].addEventListener("click", function() {
            self.toggleJoint(null, null, false);
        });
    }

    self.setWeightSmoothing = function(value) {
        self.dom["wp-smoothing-value"].innerText = value;
        for(var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].shaderHelper.smoothing = value;
        }
    }
    self.setWeightPainting = function(active) {
        for(var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].PARAMS.weightPaintingMode = active;
            self.controls.enablePan = !active;
        }
    }
    self.setUseWeightPainting = function(active) {
        for(var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].shaderHelper.setUseVertexWeights(active);
        }
    }
    self.setWeightBrushStrength = function(value) {
        self.dom["wp-brush-strength-value"].innerText = value;
        for(var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].shaderHelper.brushStrength = value;
        }
    }
    self.setWeightBrushSize = function(value) {
        self.dom["wp-brush-size-value"].innerText = value;
        for(var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].shaderHelper.brushSize = value;
        }
    }
    self.setDisplayVertexWeights = function(active) {
        for(var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].shaderHelper.setVertexColorMaterial(active);
        }
    }

    self.addBarInfo = function(message, progress) {
        self.dom["progress"].classList.remove("hidden");
        if(message != null) self.dom["progress-message"].innerText = message;
        if(progress != null) self.dom["progress-bar1"].style.width = progress + "%";
    }

    self.hideBar = function() {
        self.dom["progress"].classList.add("hidden");
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
        self.dom["vs-flappy-power-value"].innerText = self.currentInteractiveSkeleton[0].PARAMS.weights.flappy;
        self.dom["vs-squashy-power"].value = self.currentInteractiveSkeleton[0].PARAMS.weights.squashy;
        self.dom["vs-squashy-power-value"].innerText = self.currentInteractiveSkeleton[0].PARAMS.weights.squashy;
        self.dom["vs-global-power"].value = self.currentInteractiveSkeleton[0].PARAMS.weights.globalFactor;
        self.dom["vs-global-power-value"].innerText = self.currentInteractiveSkeleton[0].PARAMS.weights.globalFactor;
        self.dom["vs-alpha"].value = self.currentInteractiveSkeleton[0].PARAMS.alpha;
        self.dom["vs-alpha-value"].innerText = self.currentInteractiveSkeleton[0].PARAMS.alpha;
        self.dom["anim-speed-multiplier"].value = self.currentInteractiveSkeleton[0].PARAMS.animationSpeedMultiplier;
        self.dom["weight-painting"].checked = self.currentInteractiveSkeleton[0].PARAMS.weightPaintingMode;
        self.dom["vertex-weights"].checked = self.currentInteractiveSkeleton[0].shaderHelper.vertexWeightsDisplay;
        self.dom["use-vertex-weights"].checked = self.currentInteractiveSkeleton[0].shaderHelper.useVertexWeights;
        self.dom["wp-brush-size-value"].innerText = self.currentInteractiveSkeleton[0].shaderHelper.brushSize;
        self.dom["wp-brush-size"].value = self.currentInteractiveSkeleton[0].shaderHelper.brushSize;
        self.dom["wp-brush-strength-value"].innerText = self.currentInteractiveSkeleton[0].shaderHelper.brushStrength;
        self.dom["wp-brush-strength"].value = self.currentInteractiveSkeleton[0].shaderHelper.brushStrength;
        self.dom["wp-smoothing-value"].innerText = self.currentInteractiveSkeleton[0].shaderHelper.smoothing;
        self.dom["wp-smoothing"].value = self.currentInteractiveSkeleton[0].shaderHelper.smoothing;
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
        self.updateBoneSelectionUI();
    }

    self.updateBoneSelectionUI = function() {
        self.dom["bone-dropdown"].innerHTML = "";
        for(var isk in self.currentInteractiveSkeleton) {
            for(var j in self.currentInteractiveSkeleton[isk].joints) {
                var boneElement = document.createElement("div");
                boneElement.setAttribute("joint-index", j);
                boneElement.setAttribute("isk-index", isk);
                boneElement.innerText = self.currentInteractiveSkeleton[isk].joints[j].boneObject.name + "-" + isk;
                boneElement.classList.add("animation-item");
                if(!self.currentInteractiveSkeleton[isk].getToggleJointVS(parseInt(j))) boneElement.classList.add("bone-disabled");
                self.dom["bone-dropdown"].appendChild(boneElement);
                boneElement.addEventListener("click", function() {
                    self.selectedJoint = [parseInt(this.getAttribute("isk-index")), parseInt(this.getAttribute("joint-index"))];
                    self.toggleJoint(self.selectedJoint[0], self.selectedJoint[1], this.classList.contains("bone-disabled"));
                });
                boneElement.addEventListener("mouseover", function() {
                    self.currentInteractiveSkeleton[parseInt(this.getAttribute("isk-index"))].setBoneReprColor(parseInt(this.getAttribute("joint-index")), new THREE.Color(0xFFFF00));
                });
                boneElement.addEventListener("mouseout", function() {
                    self.currentInteractiveSkeleton[parseInt(this.getAttribute("isk-index"))].setBoneReprColor(parseInt(this.getAttribute("joint-index")), self.currentInteractiveSkeleton[parseInt(this.getAttribute("isk-index"))].SKELETON_COLORS.DEFAULT);
                });
            }
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
    self.setGlobalPowerFactor = function(value) {
        self.dom["vs-global-power-value"].innerText = value;
        for (var isk in self.currentInteractiveSkeleton) {
            self.currentInteractiveSkeleton[isk].PARAMS.weights.globalFactor = value;
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

    self.toggleJoint = function(interactiveSkeletonIndex, jointIndex, enabled) {
        if(interactiveSkeletonIndex == null) {
            for(var isk in self.currentInteractiveSkeleton) {
                self.currentInteractiveSkeleton[isk].toggleJointVS(jointIndex, enabled);
            }
        } else {
            self.currentInteractiveSkeleton[interactiveSkeletonIndex].toggleJointVS(jointIndex, enabled);
        }
        self.updateBoneSelectionUI();
    }

}
export{ UserInterface };