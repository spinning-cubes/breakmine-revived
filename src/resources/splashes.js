export class SplashTexts {
    static SPLASHES = `Indev!
Alpha!
oooOOOOooo!
Appl1cation was here!
AlexMinecrafter was here!
Hollow was here!
Soup was here!
Martwixgame was here!
SpinningCubes was here!
Cool!
Modern!
Runs on a TV!
Woah!
Minetest Land!
:)
:O
:p
Bleh!
Zombies (coming soon)!
Coming soon to a browser near you!
Smartfridge compatible!`.split('\n');

    static generateSplash() {
        return this.SPLASHES[Math.floor(Math.random() * this.SPLASHES.length)];
    }
}