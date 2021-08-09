import * as THREE from '../../build/three.module.js';

var ShaderHelper = function(data) {
    var self = this;
    self.data = data;
    self.maxTextureSize = 8192;
    self.shader;
    self.vertexColorMaterial;
    self.diffuseMap;
    self.vsWeightMap;
    self.colorStrength = 50;
    self.useVertexWeights = false;
    self.vertexWeightsDisplay = false;
    self.brushStrength = 1;
    self.brushSize = 1;
    self.smoothing = 0;

    self.getValidWidth = function(nb) {
        var power = 2;
        while(power < nb) {
            power = power*power;
        }
        return power > self.maxTextureSize ? self.maxTextureSize : power;
    }

    self.getValidHeight = function(nb) {
        return Math.ceil(nb / self.maxTextureSize);
    }

    self.getValidSize = function(nb) {
        return self.getValidWidth(nb) * self.getValidHeight(nb);
    }

    self.getVSWeightTexture = function() {
        return self.vsWeightMap;
    }

    self.tick = function() {
        self.generateDynamicUniformsVertex();
        self.data.skinnedMesh.material.uniformsNeedUpdate = true;
    }

    self.setVertexColorMaterial = function(set) {
        if(set) self.data.skinnedMesh.material = self.vertexColorMaterial;
        else self.data.skinnedMesh.material = self.shader;
        self.vertexWeightsDisplay = set;
    }

    self.setUseVertexWeights = function(set) {
        self.shader.vertexColors = set;
        self.shader.needsUpdate = true;
        self.useVertexWeights = set;
    }

    self.generateShader = function() {
        self.generateColors();
        self.generateStaticUniformsVertex();
        self.generateDynamicUniformsVertex();
        var shader = new THREE.ShaderMaterial({
            vertexColors: false,
            depthTest: true,
            skinning: true,
            vertexShader: document.getElementById("vertexShader").textContent,
            fragmentShader: document.getElementById("fragmentShader").textContent,
            uniforms: {
                map: {value: null},
                vs_weight_map: {value: null},
                translation: {value: self.translation},
                rotation: {value: self.rotation},
                scaling: {value: self.scaling},
                scaling_axis: {value: self.scaling_axis},
                N_vertex: {value: self.N_vertex},
                N_joint: {value: self.N_joint},
                floppy_power: {value: self.floppy_power},
                squashy_power: {value: self.squashy_power},
                view: {value: self.view},
                perspective: {value: self.perspective},
                tbo_sk0: {value: self.tbo_sk0},
                tbo_sk: {value: self.tbo_sk},
                tbo_angular_velocity: {value: self.tbo_angular_velocity},
                tbo_linear_velocity: {value: self.tbo_linear_velocity},
                texture_rig_joint: {value: self.texture_rig_joint},
                texture_rig_weight: {value: self.texture_rig_weight},
                texture_rig_cumulative_index: {value: self.texture_rig_cumulative_index},
                texture_rig_size: {value: self.texture_rig_size},
                texture_vs_rig_joint: {value: self.texture_vs_rig_joint},
                texture_vs_rig_weight: {value: self.texture_vs_rig_weight},
                texture_vs_rig_cumulative_index: {value: self.texture_vs_rig_cumulative_index},
                texture_vs_rig_size: {value: self.texture_vs_rig_size},
                texture_center_of_mass: {value: self.texture_center_of_mass}
            }
        });
        if(self.data.skinnedMesh.material.map) {
            console.log(self.data.skinnedMesh.material.map);
            self.diffuseMap = self.data.skinnedMesh.material.map;
            shader.uniforms["map"].value = self.diffuseMap;
        }
        self.vsWeightMap = new THREE.Texture(undefined, THREE.UVMapping, THREE.RepeatWrapping, THREE.RepeatWrapping);
        shader.uniforms["vs_weight_map"].value = self.vsWeightMap;
        shader.glslVersion = THREE.GLSL3;
        self.data.skinnedMesh.material = shader;
        console.log("SHADER HELPER : ", self, shader);
        self.shader = shader;
        self.vertexColorMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
			flatShading: true,
			vertexColors: true,
			shininess: 0
        });
    }

    self.generateColors = function() {
        var colors = new Float32Array( self.data.geometryAttributes.position.count * 3 );
        for(var c = 0; c < self.data.geometryAttributes.position.count * 3; c++) {
            colors[c] = 1;
        }
        self.data.skinnedMesh.geometry.setAttribute( 'color', new THREE.BufferAttribute( colors, 3 ));
    }

    self.paint = function(position) {
        if(self.smoothing > 0) self.paintSmooth(position);
        else {
            var tmpVPos = new THREE.Vector3();
            var tmpColor = new THREE.Color();
            var posWorld = self.data.skinnedMesh.localToWorld(position.clone());
            for(var i = 0; i < self.data.geometryAttributes.position.count; i++) {
                tmpVPos.fromBufferAttribute(self.data.geometryAttributes.position, i);
                var dist = self.data.skinnedMesh.localToWorld(tmpVPos).distanceToSquared(posWorld)/1000;
                console.log("Distance: ",dist);
                tmpColor.setRGB(self.data.skinnedMesh.geometry.attributes.color.getX(i), self.data.skinnedMesh.geometry.attributes.color.getY(i), Math.min(2, Math.max(0, self.data.skinnedMesh.geometry.attributes.color.getZ(i) - Math.min(self.brushStrength/(dist*self.colorStrength), 1))));
                tmpColor.r = Math.min(1, Math.max(2 - tmpColor.b, 0));
                if(dist < self.brushSize) {
                    self.data.skinnedMesh.geometry.attributes.color.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
                }
            }
            self.data.skinnedMesh.geometry.attributes.color.needsUpdate = true;
        }
    }

    self.paintSmooth = function(position) {
        var array = [];
        var indices = [];
        
        function average(data) {
            var sum = data.reduce(function(sum, value) {
                return sum + value;
            }, 0);
            var avg = sum / data.length;
            return avg;
        }

        function smooth(values, alpha) {
            var weighted = average(values) * alpha;
            var smoothed = [];
            for (var i in values) {
                var curr = values[i];
                var prev = smoothed[i - 1] || values[values.length - 1];
                var next = curr || values[0];
                var improved = Number(average([weighted, prev, curr, next]).toFixed(2));
                smoothed.push(improved);
            }
            return smoothed;
        }
        


        var tmpVPos = new THREE.Vector3();
        var tmpColor = new THREE.Color();
        var posWorld = self.data.skinnedMesh.localToWorld(position.clone());
        for(var i = 0; i < self.data.geometryAttributes.position.count; i++) {
            tmpVPos.fromBufferAttribute(self.data.geometryAttributes.position, i);
            var dist = self.data.skinnedMesh.localToWorld(tmpVPos).distanceToSquared(posWorld)/1000;
            tmpColor.setRGB(self.data.skinnedMesh.geometry.attributes.color.getX(i), self.data.skinnedMesh.geometry.attributes.color.getY(i), self.data.skinnedMesh.geometry.attributes.color.getZ(i));
            tmpColor.r = Math.min(1, Math.max(2 - tmpColor.b, 0));
            if(dist < 0.005*self.brushSize) {
                array.push(tmpColor.b - 1);
                indices.push(i);
            }
        }
        console.log("ARRAY BEFORE", array);
        array = smooth(array, 1 - self.smoothing*0.1);
        console.log("ARRAY AFTER", array);
        for(var i = 0; i < indices.length; i++) {
            var j = indices[i];
            tmpColor.setRGB(self.data.skinnedMesh.geometry.attributes.color.getX(j), self.data.skinnedMesh.geometry.attributes.color.getY(j), array[i] + 1);
            tmpColor.r = Math.min(1, Math.max(2 - tmpColor.b, 0));
            self.data.skinnedMesh.geometry.attributes.color.setXYZ(j, tmpColor.r, tmpColor.g, tmpColor.b);
        }
        self.data.skinnedMesh.geometry.attributes.color.needsUpdate = true;

    }

    self.generateStaticUniformsVertex = function() {
        var model = self.data.velocity_skinning_data;

        self.N_vertex = self.data.geometryAttributes.position.count;
        self.N_joint = model["velocity_skinning"]["center_of_mass"].length;

        self.texture_rig_cumulative_index_array = new Int32Array(self.getValidSize(Math.ceil(self.data.geometryAttributes.position.count/4)) * 4);
        for(var i = 0; i < self.data.geometryAttributes.position.count; i++) self.texture_rig_cumulative_index_array[i] = i*4;
        self.texture_rig_cumulative_index = new THREE.DataTexture(self.texture_rig_cumulative_index_array, self.getValidWidth(Math.ceil(self.data.geometryAttributes.position.count/4)), self.getValidHeight(Math.ceil(self.data.geometryAttributes.position.count/4)), THREE.RGBAIntegerFormat, THREE.IntType);
        self.texture_rig_cumulative_index.internalFormat = 'RGBA32I';

        self.texture_rig_size_array = new Int32Array(self.getValidSize(Math.ceil(self.data.geometryAttributes.position.count/4)) * 4);
        for(var i = 0; i < self.data.geometryAttributes.position.count; i++) self.texture_rig_size_array[i] = 4;
        self.texture_rig_size = new THREE.DataTexture(self.texture_rig_size_array, self.getValidWidth(Math.ceil(self.data.geometryAttributes.position.count/4)), self.getValidHeight(Math.ceil(self.data.geometryAttributes.position.count/4)), THREE.RGBAIntegerFormat, THREE.IntType);
        self.texture_rig_size.internalFormat = 'RGBA32I';

        self.texture_rig_joint_array = new Int32Array(self.getValidSize(Math.ceil(self.data.geometryAttributes.skinIndex.count)) * 4);
        for(var i = 0; i < self.data.geometryAttributes.skinIndex.count * 4; i++) self.texture_rig_joint_array[i] = self.data.geometryAttributes.skinIndex.array[i];
        self.texture_rig_joint = new THREE.DataTexture(self.texture_rig_joint_array, self.getValidWidth(self.data.geometryAttributes.skinIndex.count), self.getValidHeight(self.data.geometryAttributes.skinIndex.count), THREE.RGBAIntegerFormat, THREE.IntType);
        self.texture_rig_joint.internalFormat = 'RGBA32I';

        self.texture_rig_weight_array = new Float32Array(self.getValidSize(Math.ceil(self.data.geometryAttributes.skinWeight.count)) * 4);
        for(var i = 0; i < self.data.geometryAttributes.skinWeight.count * 4; i++) self.texture_rig_weight_array[i] = self.data.geometryAttributes.skinWeight.array[i];
        self.texture_rig_weight = new THREE.DataTexture(self.texture_rig_weight_array, self.getValidWidth(self.data.geometryAttributes.skinWeight.count), self.getValidHeight(self.data.geometryAttributes.skinWeight.count), THREE.RGBAFormat, THREE.FloatType);
        self.texture_rig_weight.internalFormat = 'RGBA32F';

        self.tbo_sk0_array = new Float32Array(self.getValidSize(Math.ceil(self.data.initialMatricesInverse.length * 4)) * 4);
        for(var i = 0; i < self.data.initialMatricesInverse.length; i++) self.data.initialMatricesInverse[i].toArray(self.tbo_sk0_array, i * 16);
        self.tbo_sk0 = new THREE.DataTexture(self.tbo_sk0_array, self.getValidWidth(self.data.initialMatricesInverse.length * 4), self.getValidHeight(self.data.initialMatricesInverse.length * 4), THREE.RGBAFormat, THREE.FloatType);
        self.tbo_sk0.internalFormat = 'RGBA32F';

        self.texture_vs_rig_joint_array = new Int32Array(self.getValidSize(Math.ceil(model["velocity_skinning"]["vertex_joint_index"].length/4)) * 4);
        for(var i = 0; i < model["velocity_skinning"]["vertex_joint_index"].length; i++) self.texture_vs_rig_joint_array[i] = model["velocity_skinning"]["vertex_joint_index"][i];
        self.texture_vs_rig_joint = new THREE.DataTexture(self.texture_vs_rig_joint_array, self.getValidWidth(Math.ceil(model["velocity_skinning"]["vertex_joint_index"].length/4)), self.getValidHeight(Math.ceil(model["velocity_skinning"]["vertex_joint_index"].length/4)), THREE.RGBAIntegerFormat, THREE.IntType);
        self.texture_vs_rig_joint.internalFormat = 'RGBA32I';

        self.texture_vs_rig_weight_array = new Float32Array(self.getValidSize(Math.ceil(model["velocity_skinning"]["vertex_joint_weight"].length/4)) * 4);
        for(var i = 0; i < model["velocity_skinning"]["vertex_joint_weight"].length; i++) self.texture_vs_rig_weight_array[i] = model["velocity_skinning"]["vertex_joint_weight"][i];
        self.texture_vs_rig_weight = new THREE.DataTexture(self.texture_vs_rig_weight_array, self.getValidWidth(Math.ceil(model["velocity_skinning"]["vertex_joint_weight"].length/4)), self.getValidHeight(Math.ceil(model["velocity_skinning"]["vertex_joint_weight"].length/4)), THREE.RGBAFormat, THREE.FloatType);
        self.texture_vs_rig_weight.internalFormat = 'RGBA32F';

        self.texture_vs_rig_size_array = new Int32Array(self.getValidSize(Math.ceil(model["velocity_skinning"]["vertex_joint_size"].length/4)) * 4);
        for(var i = 0; i < model["velocity_skinning"]["vertex_joint_size"].length; i++) self.texture_vs_rig_size_array[i] = model["velocity_skinning"]["vertex_joint_size"][i];
        self.texture_vs_rig_size = new THREE.DataTexture(self.texture_vs_rig_size_array, self.getValidWidth(Math.ceil(model["velocity_skinning"]["vertex_joint_size"].length/4)), self.getValidHeight(Math.ceil(model["velocity_skinning"]["vertex_joint_size"].length/4)), THREE.RGBAIntegerFormat, THREE.IntType);
        self.texture_vs_rig_size.internalFormat = 'RGBA32I';

        self.texture_vs_rig_cumulative_index_array = new Int32Array(self.getValidSize(Math.ceil(model["velocity_skinning"]["vertex_joint_cumulative_index"].length/4)) * 4);
        for(var i = 0; i < model["velocity_skinning"]["vertex_joint_cumulative_index"].length; i++) self.texture_vs_rig_cumulative_index_array[i] = model["velocity_skinning"]["vertex_joint_cumulative_index"][i];
        self.texture_vs_rig_cumulative_index = new THREE.DataTexture(self.texture_vs_rig_cumulative_index_array, self.getValidWidth(Math.ceil(model["velocity_skinning"]["vertex_joint_cumulative_index"].length/4)), self.getValidHeight(Math.ceil(model["velocity_skinning"]["vertex_joint_cumulative_index"].length/4)), THREE.RGBAIntegerFormat, THREE.IntType);
        self.texture_vs_rig_cumulative_index.internalFormat = 'RGBA32I';

        self.texture_center_of_mass_array = new Float32Array(self.getValidSize(Math.ceil(model["velocity_skinning"]["center_of_mass"].length * 3)) * 4);
        for(var i = 0; i < model["velocity_skinning"]["center_of_mass"].length; i++) {
            self.texture_center_of_mass_array[i*4] = model["velocity_skinning"]["center_of_mass"][i].x;
            self.texture_center_of_mass_array[i*4 + 1] = model["velocity_skinning"]["center_of_mass"][i].y;
            self.texture_center_of_mass_array[i*4 + 2] = model["velocity_skinning"]["center_of_mass"][i].z;
        }
        self.texture_center_of_mass = new THREE.DataTexture(self.texture_center_of_mass_array, self.getValidWidth(model["velocity_skinning"]["center_of_mass"].length), self.getValidHeight(model["velocity_skinning"]["center_of_mass"].length), THREE.RGBAFormat, THREE.FloatType);
        self.texture_center_of_mass.internalFormat = 'RGBA32F';
        
        
        self.tbo_sk_array = new Float32Array(self.getValidSize(self.data.currentMatrices.length * 4) * 4);
        for(var i = 0; i < self.data.currentMatrices.length; i++) self.data.currentMatrices[i].toArray(self.tbo_sk_array, i * 16);
        self.tbo_sk = new THREE.DataTexture(self.tbo_sk_array, self.getValidWidth(self.data.currentMatrices.length * 4), self.getValidHeight(self.data.currentMatrices.length * 4), THREE.RGBAFormat, THREE.FloatType);
        self.tbo_sk.internalFormat = 'RGBA32F';

        
        self.tbo_angular_velocity_array = new Float32Array(self.getValidSize(model["velocity_skinning"]["rotation_tracker"].length) * 4);
        for(var i = 0; i < model["velocity_skinning"]["rotation_tracker"].length; i++) {
            self.tbo_angular_velocity_array[i*4] = model["velocity_skinning"]["rotation_tracker"][i].current_speed.x;
            self.tbo_angular_velocity_array[i*4 + 1] = model["velocity_skinning"]["rotation_tracker"][i].current_speed.y;
            self.tbo_angular_velocity_array[i*4 + 2] = model["velocity_skinning"]["rotation_tracker"][i].current_speed.z;
        }
        self.tbo_angular_velocity = new THREE.DataTexture(self.tbo_angular_velocity_array, self.getValidWidth(model["velocity_skinning"]["rotation_tracker"].length), self.getValidHeight(model["velocity_skinning"]["rotation_tracker"].length), THREE.RGBAFormat, THREE.FloatType);
        self.tbo_angular_velocity.internalFormat = 'RGBA32F';
        
        self.tbo_linear_velocity_array = new Float32Array(self.getValidSize(model["velocity_skinning"]["speed_tracker"].length) * 4);
        for(var i = 0; i < model["velocity_skinning"]["speed_tracker"].length; i++) {
            self.tbo_linear_velocity_array[i*4] = model["velocity_skinning"]["speed_tracker"][i].current_speed.x;
            self.tbo_linear_velocity_array[i*4 + 1] = model["velocity_skinning"]["speed_tracker"][i].current_speed.y;
            self.tbo_linear_velocity_array[i*4 + 2] = model["velocity_skinning"]["speed_tracker"][i].current_speed.z;
        }
        self.tbo_linear_velocity = new THREE.DataTexture(self.tbo_linear_velocity_array, self.getValidWidth(model["velocity_skinning"]["speed_tracker"].length), self.getValidHeight(model["velocity_skinning"]["speed_tracker"].length), THREE.RGBAFormat, THREE.FloatType);
        self.tbo_linear_velocity.internalFormat = 'RGBA32F';


    }

    self.generateDynamicUniformsVertex = function() {
        var model = self.data.velocity_skinning_data;
        var object = self.data.skinnedMesh;

        if(self.shader) self.shader.uniforms.floppy_power.value = model["param"]["flappy"];
        else self.floppy_power = model["param"]["flappy"];
        if(self.shader) self.shader.uniforms.squashy_power.value = model["param"]["squashy"];
        else self.squashy_power = model["param"]["squashy"];
        self.translation = new THREE.Vector3();
        self.rotation = new THREE.Quaternion();
        self.scaling = new THREE.Vector3();
        self.scaling_axis = new THREE.Vector3(1, 1, 1);
        object.matrixWorld.decompose(self.translation, self.rotation, self.scaling);
        self.rotation = new THREE.Matrix3().setFromMatrix4(object.matrixWorld);
        self.scaling = self.scaling.length();
        self.data.camera.updateMatrixWorld(true);
        self.data.skinnedMesh.updateMatrixWorld(true);
        if(self.view) self.view.multiplyMatrices(self.data.camera.matrixWorld.clone().invert(), self.data.rootJoint.parent.matrixWorld);//self.data.skinnedMesh.modelViewMatrix;//new THREE.Matrix4().multiplyMatrices(self.data.camera.matrixWorldInverse, self.data.skinnedMesh.matrixWorld);
        else self.view = new THREE.Matrix4().multiplyMatrices(self.data.camera.matrixWorld.clone().invert(), self.data.rootJoint.parent.matrixWorld);
        self.data.camera.updateProjectionMatrix();
        self.perspective = self.data.camera.projectionMatrix;
        
        for(var i = 0; i < self.data.currentMatrices.length; i++) self.data.currentMatrices[i].toArray(self.tbo_sk_array, i * 16);
        self.tbo_sk.needsUpdate = true;

        for(var i = 0; i < model["velocity_skinning"]["rotation_tracker"].length; i++) {
            //if(i == 5) console.log(model["velocity_skinning"]["rotation_tracker"][i].current_speed);
            if (model["param"]["disabled_bones"].indexOf(i) === -1) {
                self.tbo_angular_velocity_array[i*4] = model["velocity_skinning"]["rotation_tracker"][i].current_speed.x;
                self.tbo_angular_velocity_array[i*4 + 1] = model["velocity_skinning"]["rotation_tracker"][i].current_speed.y;
                self.tbo_angular_velocity_array[i*4 + 2] = model["velocity_skinning"]["rotation_tracker"][i].current_speed.z;
            }
            else {
                self.tbo_angular_velocity_array[i*4] = 0;
                self.tbo_angular_velocity_array[i*4 + 1] = 0;
                self.tbo_angular_velocity_array[i*4 + 2] = 0;
            }
        }
        self.tbo_angular_velocity.needsUpdate = true;

        for(var i = 0; i < model["velocity_skinning"]["speed_tracker"].length; i++) {
            if (model["param"]["disabled_bones"].indexOf(i) === -1) {
                self.tbo_linear_velocity_array[i*4] = model["velocity_skinning"]["speed_tracker"][i].current_speed.x;
                self.tbo_linear_velocity_array[i*4 + 1] = model["velocity_skinning"]["speed_tracker"][i].current_speed.y;
                self.tbo_linear_velocity_array[i*4 + 2] = model["velocity_skinning"]["speed_tracker"][i].current_speed.z;
            }
            else {
                self.tbo_linear_velocity_array[i*4] = 0;
                self.tbo_linear_velocity_array[i*4 + 1] = 0;
                self.tbo_linear_velocity_array[i*4 + 2] = 0;
            }
        }
        self.tbo_linear_velocity.needsUpdate = true;

        
        
    }

}
export{ ShaderHelper };