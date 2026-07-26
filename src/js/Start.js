import Minecraft from './net/minecraft/client/Minecraft.js';
import * as aesjs from '../../libraries/aes.js';

// Handle unhandled promise rejections globally
window.addEventListener('unhandledrejection', event => {
    event.preventDefault();
});

class Start {

    loadTextures(textures) {
        let resources = [];
        let index = 0;

        return textures.reduce((currentPromise, texturePath) => {
            return currentPromise.then(() => {
                return new Promise((resolve, reject) => {
                    // Load texture
                    let image = new Image();
                    image.src = "src/resources/" + texturePath;
                    image.onload = () => resolve();
                    resources[texturePath] = image;

                    index++;
                });
            });
        }, Promise.resolve()).then(() => {
            return resources;
        });
    }

    launch(canvasWrapperId) {
        this.loadTextures([
            "misc/grasscolor.png",
            "gui/font.png",
            "gui/gui.png",
            "gui/background.png",
            "gui/icons.png",
            "terrain/terrain.png",
            "terrain/sun.png",
            "terrain/moon.png",
            "char.png",
            "gui/title/minecraft.png",
            "gui/title/background/panorama_0.png",
            "gui/title/background/panorama_1.png",
            "gui/title/background/panorama_2.png",
            "gui/title/background/panorama_3.png",
            "gui/title/background/panorama_4.png",
            "gui/title/background/panorama_5.png",
            "gui/container/creative.png",
            "gui/container/crafting_table.png",
            "gui/container/inventory.png",
            "gui/container/chest.png",
            "gui/heart.png",
            "gui/heartHalf.png",
            "gui/heartEmpty.png",
            "gui/ping.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_0.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_1.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_2.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_3.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_4.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_5.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_6.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_7.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_8.png",
            "terrain/pack/minecraft/textures/blocks/destroy_stage_9.png",
            "terrain/pack/minecraft/textures/misc/shadow.png",
        ]).then((resources) => {
            // Launch actual game on canvas
            window.app = new Minecraft(canvasWrapperId, resources);
        });
    }
}

// Listen on history back
window.addEventListener('pageshow', function (event) {
    if (window.app) {
        // Reload page to restart the game
        if (!window.app.running) {
            window.location.reload();
        }
    } else {
        // Launch game
        new Start().launch("canvas-container");
    }
});

export function require(module) {
    return window[module];
}