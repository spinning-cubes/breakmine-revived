import BlockLog from "./type/BlockLog.js";
import BlockStone from "./type/BlockStone.js";
import BlockGrass from "./type/BlockGrass.js";
import BlockDirt from "./type/BlockDirt.js";
import BlockLeave from "./type/BlockLeave.js";
import BlockWater from "./type/BlockWater.js";
import BlockSand from "./type/BlockSand.js";
import BlockTorch from "./type/BlockTorch.js";
import Sound from "./sound/Sound.js";
import Block from "./Block.js";
import BlockWood from "./type/BlockWood.js";
import BlockBedrock from "./type/BlockBedrock.js";
import BlockGlass from "./type/BlockGlass.js";
import SoundGlass from "./sound/SoundGlass.js";
import BlockGravel from "./type/BlockGravel.js";
import BlockCobblestone from "./type/BlockCobblestone.js";
import BlockGrassPath from "./type/BlockGrassPath.js";
import BlockStoneLike from "./type/BlockStoneLike.js";
import BlockCraftingTable from "./type/BlockCraftingTable.js";
import BlockChest from "./type/BlockChest.js";
import BlockMissing from "./type/BlockMissing.js";
import BlockBrick from "./type/BlockBrick.js";
import BlockFurnace from "./type/BlockFurnace.js";
import ItemApple from "./type/ItemApple.js";
import ItemBread from "./type/ItemBread.js";
import ItemStick from "./type/ItemStick.js";
import ItemGeneric from "./type/ItemGeneric.js";
import ItemPickaxe from "./type/ItemPickaxe.js";
import ItemSword from "./type/ItemSword.js";
import ItemShovel from "./type/ItemShovel.js";
import ItemAxe from "./type/ItemAxe.js";
import ItemHoe from "./type/ItemHoe.js";
import ItemBucketWater from "./type/ItemBucketWater.js";
import ItemBucketEmpty from "./type/ItemBucketEmpty.js";
import BlockBush from "./type/BlockBush.js";
import BlockFence from "./type/BlockFence.js";
import BlockWoodPanel from "./type/BlockWoodPanel.js";
import SoundGrass from "./sound/SoundGrass.js";
import BlockWool from "./type/BlockWool.js";
import BlockLava from "./type/BlockLava.js";
import BlockLogic from "./type/BlockLogic.js";
import BlockMossyCobblestone from "./type/BlockMossyCobblestone.js";
import BlockSlab from "./type/BlockSlab.js";
import BlockBeans from "./type/BlockBeans.js";
import BlockMoldyBeans from "./type/BlockMoldyBeans.js";
import BlockWire from "./type/BlockWire.js";
import ItemBucketLava from "./type/ItemBucketLava.js";

export class BlockRegistry {

    static init = false;

    static create() {
        // Sounds
        Block.sounds.stone = new Sound("stone", 1.0);
        Block.sounds.wood = new Sound("wood", 1.0);
        Block.sounds.gravel = new Sound("gravel", 1.0);
        Block.sounds.grass = new SoundGrass("grass", 1.0);
        Block.sounds.cloth = new Sound("cloth", 1.0);
        Block.sounds.sand = new Sound("sand", 1.0);
        Block.sounds.glass = new SoundGlass("stone", 1.0);
        Block.sounds.leaves = new Sound("leaves", 1.0);

        // Blocks
        BlockRegistry.STONE = new BlockStone(1, 0);
        BlockRegistry.GRASS = new BlockGrass(2, 1);
        BlockRegistry.DIRT = new BlockDirt(3, 2);
        BlockRegistry.COBBLE_STONE = new BlockCobblestone(4, 14);
        BlockRegistry.WOOD = new BlockWood(5, 10, "oak", "Oak Planks");
        BlockRegistry.MOSSY_COBBLESTONE = new BlockMossyCobblestone(6, 14);
        BlockRegistry.BEDROCK = new BlockBedrock(7, 11);
        BlockRegistry.GRAVEL = new BlockGravel(13, 13);
        BlockRegistry.LOG = new BlockLog(17, 4, "oak", "Oak Log");
        BlockRegistry.LEAVE = new BlockLeave(18, 6);
        BlockRegistry.GLASS = new BlockGlass(20, 12);
        BlockRegistry.WATER = new BlockWater(9, 7);
        BlockRegistry.SAND = new BlockSand(12, 8);
        BlockRegistry.TORCH = new BlockTorch(50, 9);
        BlockRegistry.GRASS_PATH = new BlockGrassPath(19, 15);

        BlockRegistry.GOLD_ORE = new BlockStoneLike(21, 0, "gold_ore", "Gold Ore", 3.0, [21, 1], 'iron');
        BlockRegistry.DIAMOND_ORE = new BlockStoneLike(22, 0, "diamond_ore", "Diamond Ore", 3.0, [88, 1], 'iron');
        BlockRegistry.COAL_ORE = new BlockStoneLike(23, 0, "coal_ore", "Coal Ore", 3.0, [87, 2], 'wood');
        BlockRegistry.IRON_ORE = new BlockStoneLike(24, 0, "iron_ore", "Iron Ore", 3.0, [24, 1], 'stone');
        BlockRegistry.IRON_BLOCK = new BlockStoneLike(25, 0, "iron_block", "Iron Block", 3.0, [25, 0], 'stone');
        BlockRegistry.GOLD_BLOCK = new BlockStoneLike(26, 0, "gold_block", "Gold Block", 3.0, [26, 0], 'iron');
        BlockRegistry.DIAMOND_BLOCK = new BlockStoneLike(27, 0, "diamond_block", "Diamond Block", 3.0, [27, 0], 'iron');
        BlockRegistry.EMERALD_BLOCK = new BlockStoneLike(28, 0, "emerald_block", "Emerald Block", 3.0, [28, 0], 'iron');
        BlockRegistry.COAL_BLOCK = new BlockStoneLike(29, 0, "coal_block", "Coal Block", 3.0, [29, 0], 'wood');
        BlockRegistry.EMERALD_ORE = new BlockStoneLike(30, 0, "emerald_ore", "Emerald Ore", 3.0, [89, 1], 'iron');

        BlockRegistry.CRAFTING_TABLE = new BlockCraftingTable(31, 0);
        BlockRegistry.CHEST = new BlockChest(32, 0);
        BlockRegistry.BRICK = new BlockBrick(33, 0);
        BlockRegistry.FURNACE = new BlockFurnace(34, 0);
        BlockRegistry.BUSH = new BlockBush(35, 0);
        BlockRegistry.FENCE = new BlockFence(36, 0, "oak", 5);
        BlockRegistry.WOOD_PANEL = new BlockWoodPanel(37, 0);
        BlockRegistry.WHITE_WOOL = new BlockWool(38, 0, "white_wool", "White Wool");
        BlockRegistry.ORANGE_WOOL = new BlockWool(39, 0, "orange_wool", "Orange Wool");
        BlockRegistry.MAGENTA_WOOL = new BlockWool(40, 0, "magenta_wool", "Magenta Wool");
        BlockRegistry.LIGHT_BLUE_WOOL = new BlockWool(41, 0, "light_blue_wool", "Light Blue Wool");
        BlockRegistry.YELLOW_WOOL = new BlockWool(42, 0, "yellow_wool", "Yellow Wool");
        BlockRegistry.LIME_WOOL = new BlockWool(43, 0, "lime_wool", "Lime Wool");
        BlockRegistry.PINK_WOOL = new BlockWool(44, 0, "pink_wool", "Pink Wool");
        BlockRegistry.GRAY_WOOL = new BlockWool(45, 0, "gray_wool", "Gray Wool");
        BlockRegistry.LIGHT_GRAY_WOOL = new BlockWool(46, 0, "light_gray_wool", "Light Gray Wool");
        BlockRegistry.CYAN_WOOL = new BlockWool(47, 0, "cyan_wool", "Cyan Wool");
        BlockRegistry.PURPLE_WOOL = new BlockWool(48, 0, "purple_wool", "Purple Wool");
        BlockRegistry.BLUE_WOOL = new BlockWool(49, 0, "blue_wool", "Blue Wool");
        BlockRegistry.BROWN_WOOL = new BlockWool(54, 0, "brown_wool", "Brown Wool");
        BlockRegistry.GREEN_WOOL = new BlockWool(51, 0, "green_wool", "Green Wool");
        BlockRegistry.RED_WOOL = new BlockWool(52, 0, "red_wool", "Red Wool");
        BlockRegistry.BLACK_WOOL = new BlockWool(53, 0, "black_wool", "Black Wool");
        BlockRegistry.LAVA = new BlockLava(55, 0);
        BlockRegistry.LOGIC = new BlockLogic(56, 0);
        BlockRegistry.TAN_WOOL = new BlockWool(57, 0, "tan_wool", "Tan Wool");

        // Spruce
        BlockRegistry.SPRUCE_PLANKS = new BlockWood(58, 0, "spruce", "Spruce Planks");
        BlockRegistry.SPRUCE_LOG = new BlockLog(59, 0, "spruce", "Spruce Log");
        BlockRegistry.SPRUCE_FENCE = new BlockFence(60, 0, "spruce", 58);

        // Birch
        BlockRegistry.BIRCH_PLANKS = new BlockWood(61, 0, "birch", "Birch Planks");
        BlockRegistry.BIRCH_LOG = new BlockLog(62, 0, "birch", "Birch Log");
        BlockRegistry.BIRCH_FENCE = new BlockFence(63, 0, "birch", 61);

        // Jungle
        BlockRegistry.JUNGLE_PLANKS = new BlockWood(64, 0, "jungle", "Jungle Planks");
        BlockRegistry.JUNGLE_LOG = new BlockLog(65, 0, "jungle", "Jungle Log");
        BlockRegistry.JUNGLE_FENCE = new BlockFence(66, 0, "jungle", 64);

        // Acacia
        BlockRegistry.ACACIA_PLANKS = new BlockWood(67, 0, "acacia", "Acacia Planks");
        BlockRegistry.ACACIA_LOG = new BlockLog(68, 0, "acacia", "Acacia Log");
        BlockRegistry.ACACIA_FENCE = new BlockFence(69, 0, "acacia", 67);

        // Slabs
        BlockRegistry.COBBLESTONE_SLAB = new BlockSlab(70, 0, "cobblestone", "Cobblestone Slab", Block.sounds.stone);
        BlockRegistry.WOOD_SLAB = new BlockSlab(71, 0, "oak_planks", "Oak Slab", Block.sounds.wood);
        BlockRegistry.SPRUCE_SLAB = new BlockSlab(72, 0, "spruce_planks", "Spruce Slab", Block.sounds.wood);
        BlockRegistry.BIRCH_SLAB = new BlockSlab(73, 0, "birch_planks", "Birch Slab", Block.sounds.wood);
        BlockRegistry.JUNGLE_SLAB = new BlockSlab(74, 0, "jungle_planks", "Jungle Slab", Block.sounds.wood);
        BlockRegistry.ACACIA_SLAB = new BlockSlab(75, 0, "acacia_planks", "Acacia Slab", Block.sounds.wood);
        BlockRegistry.MOSSY_COBBLESTONE_SLAB = new BlockSlab(76, 0, "mossy_cobblestone", "Mossy Cobblestone Slab", Block.sounds.stone);
        BlockRegistry.BRICK_SLAB = new BlockSlab(77, 0, "brick", "Brick Slab", Block.sounds.stone);

        BlockRegistry.BEANS = new BlockBeans(78, 0);
        BlockRegistry.MOLDY_BEANS = new BlockMoldyBeans(79, 0);
        BlockRegistry.WIRE = new BlockWire(80, 0);

        BlockRegistry.SAPPHIRE_ORE = new BlockStoneLike(81, 0, "sapphire_ore", "Sapphire Ore");
        BlockRegistry.SAPPHIRE_BLOCK = new BlockStoneLike(82, 0, "sapphire_block", "Sapphire Block");

        // Items
        BlockRegistry.ITEM_APPLE = new ItemApple(83, 14);
        BlockRegistry.ITEM_BREAD = new ItemBread(84, 15);
        BlockRegistry.ITEM_STICK = new ItemStick(85, 16);

        BlockRegistry.ITEM_IRON = new ItemGeneric(86, 'iron_ingot', 'Iron Ingot');
        BlockRegistry.ITEM_COAL = new ItemGeneric(87, 'coal', 'Coal');
        BlockRegistry.ITEM_DIAMOND = new ItemGeneric(88, 'diamond', 'Diamond');
        BlockRegistry.ITEM_EMERALD = new ItemGeneric(89, 'emerald', 'Emerald');
        BlockRegistry.ITEM_GOLD = new ItemGeneric(90, 'gold_ingot', 'Gold Ingot');

        BlockRegistry.STONEBRICK = new BlockStoneLike(116, 0, "stonebrick", "Stone Bricks");
        BlockRegistry.DARK_STONEBRICK = new BlockStoneLike(117, 0, "dark_stonebrick", "Dark Stone Bricks");

        // Tools (IDs 91-115)
        const toolMaterials = ['wood', 'stone', 'iron', 'diamond', 'gold'];
        let toolId = 91;
        for (const mat of toolMaterials) {
            const matName = mat === 'wood' ? 'Wooden' : mat.charAt(0).toUpperCase() + mat.slice(1);
            const itemName = mat === 'gold' ? 'Golden' : mat;
            const texName = mat === 'gold' ? 'golden' : mat === 'wood' ? 'wooden' : mat;
            BlockRegistry[`${mat.toUpperCase()}_PICKAXE`] = new ItemPickaxe(toolId++, `${texName}_pickaxe`, `${matName} Pickaxe`, mat);
            BlockRegistry[`${mat.toUpperCase()}_SWORD`] = new ItemSword(toolId++, `${texName}_sword`, `${matName} Sword`, mat);
            BlockRegistry[`${mat.toUpperCase()}_SHOVEL`] = new ItemShovel(toolId++, `${texName}_shovel`, `${matName} Shovel`, mat);
            BlockRegistry[`${mat.toUpperCase()}_AXE`] = new ItemAxe(toolId++, `${texName}_axe`, `${matName} Axe`, mat);
            BlockRegistry[`${mat.toUpperCase()}_HOE`] = new ItemHoe(toolId++, `${texName}_hoe`, `${matName} Hoe`, mat);
        }

        BlockRegistry.ITEM_BUCKET_EMPTY = new ItemBucketEmpty(118, 'bucket', 'Empty Bucket');
        BlockRegistry.ITEM_BUCKET_WATER = new ItemBucketWater(119, 'water_bucket', 'Water Bucket');
        BlockRegistry.ITEM_BUCKET_LAVA = new ItemBucketLava(120, 'lava_bucket', 'Lava Bucket');

        BlockRegistry.init = true;
    }

    static getAllBlocks() {
        return this;
    }
}