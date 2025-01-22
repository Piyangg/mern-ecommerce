import cloudinary from "../lib/cloudinary.js";
import { redis } from "../lib/redis.js"
import Product from "../models/product.model.js";

export const getAllProducts = async (req,res) => {
    try {
        const products = await Product.find({});
        res.json({products});
    } catch (error) {
        console.log("Error in getAllProducts Controller", error.message);
        res.status(500).json({message: "save error", error: error.message});


        
    }
};

export const getFeaturedProducts = async (req, res) => {
    try {
      let featuredProducts = await redis.get("featured products")
      if(featuredProducts){
        return res.json(JSON.parse(featuredProducts));
      }
      featuredProducts = await Product.find({isFeatured:true}).lean();

      if(!featuredProducts) {
        return res.status(404).json({message:"No Featured Products found"});
      }

      await redis.set("featured_products", JSON.stringify(featuredProducts));

      res.json(featuredProducts);
    } catch (error) {
        console.log("Error in getFeaturedProducts controller", error.message);
        res.status(500).json({message: "Server error", error: error.message});
        
    }
};

export const createProduct = async (req,res) => {
    try {
        const {name, description, price, image, category} = req.body;
        let cloudinaryResponse = null

        if(image){
          cloudinaryResponse = await cloudinary.uploader.upload(image, {folder:"products"})
        }

        const product = await Product.create({
            name,
            description,
            price,
            image: cloudinaryResponse?.secure_url ? cloudinaryResponse.secure_url: "",
            category
        })

        res.status(201).json(product)
    } catch (error) {
        console.log("Error in createProduct controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message});
    }
};

export const deleteProduct = async (req,res) => {
    try {
        const product = await Product.findById(req.params.id)

        if(!product) {
            return res.status(404).json({ message: "Product not found"});
        }

        if(product.image){
            const publicId = product.image.split("/").pop().split(".")[0];
            try {
                await cloudinary.uploader.destroy(`products/${publicId}`)
                console.log("deleted image from cloudinary")
            } catch (error) {
                console.log("error deleting image from cloudinary", error)
            }
        }

        await Product.findByIdAndDelete(req.params.id)

        res.json({ message: "Product deleted successfully"})
    } catch (error) {
        console.log("Error in deleteProduct controller", error.message)
        res.status(500).json({ message: "Server error", error: error.message})
        
    }
};

export const getRecommendedProducts = async (req,res) => {
    try {
        const products = await Product.aggregate([
            {
                $sample: {size:3}
            },
            {
                $project:{
                    _id:1,
                    name:1,
                    description:1,
                    image:1,
                    price:1
                }
            }
        ])

        res.json(products)
    } catch (error) {
        console.log("Error in getRecommendedProducts controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message});
    }
};

export const getProductByCategory = async (req,res) => {
    const {category} = req.params;
    try {

        const products = await Product.find({category});
        res.json({ products });
        
    } catch (error) {
        console.log("Error in getProductByCategory controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message});
    }
};

export const toggleFeaturedProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if(product){
            product.isFeatured = !product.isFeatured;
            const updatedProduct = await product.save();
            await updateFeaturedProductsCache();
            res.json(updatedProduct);
        } else {
            res.status(400).json({ message: "Product not found"});
        }
    } catch (error) {
        console.log("Error in ToggleFeaturedProduct controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message});
    }
}

async function updateFeaturedProductsCache() {
    try {
        const featuredProducts = await Product.find({isFeatured:true}).lean();
        await redis.set("featured_products", JSON.stringify(featuredProducts));
    } catch (error) {
        console.log("error in update function");
        
    }
}