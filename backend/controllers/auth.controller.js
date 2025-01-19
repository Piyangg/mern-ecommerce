import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

const generateTokens = (userId) => {
    console.log("ACCESS_TOKEN_SECRET:", process.env.ACCESS_TOKEN_SECRET);  // Debugging log
    console.log("REFRESH_TOKEN_SECRET:", process.env.REFRESH_TOKEN_SECRET); // Debugging log

    const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "15m", // 15 minutes
    });

    const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: "7d", // 7 days
    });

    return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
    // Corrected Redis set command
    await redis.set(`refresh_token:${userId}`, refreshToken, 'EX', 7 * 24 * 60 * 60);  // 7 days in seconds
};

const setCookies = (res, accessToken, refreshToken) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return;
};


//SIGN UP
export const signup = async (req, res) => {
    const { email, password, name } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        const user = await User.create({ name, email, password });

        // Generate authentication tokens
        const { accessToken, refreshToken } = generateTokens(user._id);
        await storeRefreshToken(user._id, refreshToken);

        setCookies(res, accessToken, refreshToken);

        return res.status(201).json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            message: "User created successfully",
        });

    } catch (error) {
        console.log("Signup Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

//LOGIN
export const login = async (req, res) => {
    try {

       
        const {email, password} = req.body;
        const user = await User.findOne({email});


        if(user && (await user.comparePassword(password))) {
          const {accessToken,refreshToken} = generateTokens(user._id)
         console.log("user is logged in");
          await storeRefreshToken(user._id, refreshToken)
          setCookies(res, accessToken, refreshToken)

          res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          })
        } else {
            res.status(401).json({ message: "Invalid email or password"});
        }
    } catch (error) {
        console.log("Error in login controller", error.message);
        res.status(500).json({message: error.message});
    }
};

//LOGOUT
export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if(refreshToken){
            const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            await redis.del(`refresh_token:${decoded.userId}`)
        }

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        res.json({ message:"Logout successfully"});
    } catch (error) {
        console.log("Error in input controller", error.message);
        res.status(500).json({message: "Server error", error: error.message});
    }
};


//REFRESH ACCESS TOKEN
export const refreshToken = async (req,res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if(!refreshToken){
            return res.status(401).json({message: "No refresh token provided"});
        }

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

        if(storedToken !== refreshToken){
            return res.status(401).json({ message:"Invalid refresh token"});
        }

        const accessToken = jwt.sign({ userId:decoded.userId}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "15m"});

        res.cookie("accessToken", accessToken,{
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 15 * 60 * 1000,
        });

        res.json({ message: "Token refreshed successfully"});
    } catch (error) {
        console.log("Error in refreshToken controller", error.message);
        res.status(500).json({message: "Server error", error: error.message});
    }
};


export const getProfile = async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        
    }
}
