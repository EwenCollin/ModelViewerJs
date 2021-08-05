import * as THREE from '../../build/three.module.js';

var ShaderHelper = function(data) {
    var self = this;
    self.data = data;
    self.maxTextureSize = 8192;

    self.getValidWidth = function(nb) {
        var power = 2;
        while(power < nb) {
            power = power*power;
        }
        return power;
    }

    self.tick = function() {
        self.generateDynamicUniformsVertex();
        self.data.skinnedMesh.material.uniformsNeedUpdate = true;
    }

    self.generateShader = function() {
        self.generateStaticUniformsVertex();
        self.generateDynamicUniformsVertex();
        
        var shader = new THREE.ShaderMaterial({
            depthTest: true,
            skinning: true,
            vertexShader: document.getElementById("vertexShader").textContent,
            fragmentShader: document.getElementById("fragmentShader").textContent,
            uniforms: {
                map: {value: null},
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
            shader.uniforms["map"].value = self.data.skinnedMesh.material.map.clone();
        }
        shader.glslVersion = THREE.GLSL3;
        self.data.skinnedMesh.material = shader;
    }

    self.generateStaticUniformsVertex = function() {
        var model = self.data.velocity_skinning_data;

        self.N_vertex = self.data.geometryAttributes.position.count;
        self.N_joint = model["velocity_skinning"]["center_of_mass"].length;

        self.texture_rig_cumulative_index_array = new Uint8Array(self.data.geometryAttributes.position.count);
        for(var i = 0; i < self.data.geometryAttributes.position.count; i++) self.texture_rig_cumulative_index_array[i] = i * 4;
        self.texture_rig_cumulative_index = new THREE.DataTexture(self.texture_rig_cumulative_index_array, self.getValidWidth(Math.floor(self.data.geometryAttributes.position.count/4) + 1), 1, THREE.RGBAFormat, THREE.UnsignedByteType);

        self.texture_rig_size_array = new Uint8Array(self.data.geometryAttributes.position.count);
        for(var i = 0; i < self.data.geometryAttributes.position.count; i++) self.texture_rig_size_array[i] = 4;
        self.texture_rig_size = new THREE.DataTexture(self.texture_rig_size_array, self.getValidWidth(Math.floor(self.data.geometryAttributes.position.count/4) + 1), 1, THREE.RGBAFormat, THREE.UnsignedByteType);

        self.texture_rig_joint_array = new Uint8Array(self.data.geometryAttributes.position.count * 4);
        for(var i = 0; i < self.data.geometryAttributes.position.count * 4; i++) self.texture_rig_joint_array[i] = self.data.geometryAttributes.skinIndex.array[i];
        self.texture_rig_joint = new THREE.DataTexture(self.texture_rig_joint_array, self.getValidWidth(self.data.geometryAttributes.position.count), 1, THREE.RGBAFormat, THREE.UnsignedByteType);

        self.texture_rig_weight_array = new Float32Array(self.data.geometryAttributes.position.count * 4);
        for(var i = 0; i < self.data.geometryAttributes.position.count * 4; i++) self.texture_rig_weight_array[i] = self.data.geometryAttributes.skinWeight.array[i];
        self.texture_rig_weight = new THREE.DataTexture(self.texture_rig_weight_array, self.getValidWidth(self.data.geometryAttributes.position.count), 1, THREE.RGBAFormat, THREE.FloatType);

        self.tbo_sk0_array = new Float32Array(self.data.initialMatricesInverse.length * 16);
        for(var i = 0; i < self.data.initialMatricesInverse.length; i++) self.data.initialMatricesInverse[i].toArray(self.tbo_sk0_array, i * 16);
        self.tbo_sk0 = new THREE.DataTexture(self.tbo_sk0_array, self.getValidWidth(self.data.initialMatricesInverse.length * 4), 1, THREE.RGBAFormat, THREE.FloatType);


        self.texture_vs_rig_joint_array = new Uint8Array(model["velocity_skinning"]["vertex_joint_index"].length);
        for(var i = 0; i < model["velocity_skinning"]["vertex_joint_index"].length; i++) self.texture_vs_rig_joint_array[i] = model["velocity_skinning"]["vertex_joint_index"][i];
        self.texture_vs_rig_joint = new THREE.DataTexture(self.texture_vs_rig_joint_array, Math.floor(model["velocity_skinning"]["vertex_joint_index"].length/4)+1 >= self.maxTextureSize ? self.maxTextureSize : self.getValidWidth(Math.floor(model["velocity_skinning"]["vertex_joint_index"].length/4)+1), Math.floor(model["velocity_skinning"]["vertex_joint_index"].length/self.maxTextureSize) + 1, THREE.RGBAFormat, THREE.UnsignedByteType);

        self.texture_vs_rig_weight_array = new Float32Array(model["velocity_skinning"]["vertex_joint_weight"].length);
        for(var i = 0; i < model["velocity_skinning"]["vertex_joint_weight"].length; i++) self.texture_vs_rig_weight_array[i] = model["velocity_skinning"]["vertex_joint_weight"][i];
        self.texture_vs_rig_weight = new THREE.DataTexture(self.texture_vs_rig_weight_array, Math.floor(model["velocity_skinning"]["vertex_joint_weight"].length/4)+1 >= self.maxTextureSize ? self.maxTextureSize : self.getValidWidth(Math.floor(model["velocity_skinning"]["vertex_joint_weight"].length/4)+1), Math.floor(model["velocity_skinning"]["vertex_joint_weight"].length/self.maxTextureSize) + 1, THREE.RGBAFormat, THREE.FloatType);

        self.texture_vs_rig_size_array = new Uint8Array(model["velocity_skinning"]["vertex_joint_size"].length);
        for(var i = 0; i < model["velocity_skinning"]["vertex_joint_size"].length; i++) self.texture_vs_rig_size_array[i] = model["velocity_skinning"]["vertex_joint_size"][i];
        self.texture_vs_rig_size = new THREE.DataTexture(self.texture_vs_rig_size_array, self.getValidWidth(Math.floor(model["velocity_skinning"]["vertex_joint_size"].length/4)+1), 1, THREE.RGBAFormat, THREE.UnsignedByteType);

        self.texture_vs_rig_cumulative_index_array = new Uint8Array(model["velocity_skinning"]["vertex_joint_cumulative_index"].length);
        for(var i = 0; i < model["velocity_skinning"]["vertex_joint_cumulative_index"].length; i++) self.texture_vs_rig_cumulative_index_array[i] = model["velocity_skinning"]["vertex_joint_cumulative_index"][i];
        self.texture_vs_rig_cumulative_index = new THREE.DataTexture(self.texture_vs_rig_cumulative_index_array, self.getValidWidth(Math.floor(model["velocity_skinning"]["vertex_joint_cumulative_index"].length/4)+1), 1, THREE.RGBAFormat, THREE.UnsignedByteType);


        self.texture_center_of_mass_array = new Float32Array(model["velocity_skinning"]["center_of_mass"].length * 3);
        for(var i = 0; i < model["velocity_skinning"]["center_of_mass"].length; i++) {
            self.texture_center_of_mass_array[i*3] = model["velocity_skinning"]["center_of_mass"][i].x;
            self.texture_center_of_mass_array[i*3 + 1] = model["velocity_skinning"]["center_of_mass"][i].y;
            self.texture_center_of_mass_array[i*3 + 2] = model["velocity_skinning"]["center_of_mass"][i].z;
        }
        self.texture_center_of_mass = new THREE.DataTexture(self.texture_center_of_mass_array, self.getValidWidth(model["velocity_skinning"]["center_of_mass"].length), 1, THREE.RGBFormat, THREE.FloatType);


        
        self.tbo_sk_array = new Float32Array(self.data.currentMatrices.length * 16);
        self.tbo_angular_velocity_array = new Float32Array(model["velocity_skinning"]["rotation_tracker"].length * 3);
        self.tbo_linear_velocity_array = new Float32Array(model["velocity_skinning"]["speed_tracker"].length * 3);

    }

    self.generateDynamicUniformsVertex = function() {
        var model = self.data.velocity_skinning_data;
        var object = self.data.skinnedMesh;

        self.translation = new THREE.Vector3();
        self.rotation = new THREE.Quaternion();
        self.scaling = new THREE.Vector3();
        self.scaling_axis = new THREE.Vector3(1, 1, 1);
        object.matrixWorld.decompose(self.translation, self.rotation, self.scaling);
        self.rotation = new THREE.Matrix3().setFromMatrix4(object.matrixWorld);
        self.scaling = self.scaling.length();
        self.floppy_power = self.data.PARAMS.weights.globalFactor*self.data.PARAMS.weights.flappy;
        self.squashy_power = self.data.PARAMS.weights.globalFactor*self.data.PARAMS.weights.squashy;

        self.view = self.data.skinnedMesh.modelViewMatrix;
        self.perspective = self.data.camera.projectionMatrix;
        


        for(var i = 0; i < self.data.currentMatrices.length; i++) self.data.currentMatrices[i].toArray(self.tbo_sk_array, i * 16);
        self.tbo_sk = new THREE.DataTexture(self.tbo_sk_array, self.data.currentMatrices.length * 4, 1, THREE.RGBAFormat, THREE.FloatType);

        for(var i = 0; i < model["velocity_skinning"]["rotation_tracker"].length; i++) {
            self.tbo_angular_velocity_array[i*3] = model["velocity_skinning"]["rotation_tracker"][i].current_speed.x;
            self.tbo_angular_velocity_array[i*3 + 1] = model["velocity_skinning"]["rotation_tracker"][i].current_speed.y;
            self.tbo_angular_velocity_array[i*3 + 2] = model["velocity_skinning"]["rotation_tracker"][i].current_speed.z;
        }
        self.tbo_angular_velocity = new THREE.DataTexture(self.tbo_angular_velocity_array, self.getValidWidth(model["velocity_skinning"]["rotation_tracker"].length), 1, THREE.RGBFormat, THREE.FloatType);

        for(var i = 0; i < model["velocity_skinning"]["speed_tracker"].length; i++) {
            self.tbo_linear_velocity_array[i*3] = model["velocity_skinning"]["speed_tracker"][i].current_speed.x;
            self.tbo_linear_velocity_array[i*3 + 1] = model["velocity_skinning"]["speed_tracker"][i].current_speed.y;
            self.tbo_linear_velocity_array[i*3 + 2] = model["velocity_skinning"]["speed_tracker"][i].current_speed.z;
        }
        self.tbo_linear_velocity = new THREE.DataTexture(self.tbo_linear_velocity_array, self.getValidWidth(model["velocity_skinning"]["speed_tracker"].length), 1, THREE.RGBFormat, THREE.FloatType);

        
    }

}
export{ ShaderHelper };