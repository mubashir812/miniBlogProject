
require("dotenv").config();

const cookieParser = require('cookie-parser');
const express = require('express');
const userModel = require('./models/user');
const postModel = require('./models/post');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const upload = require('./config/multerconfig');

const app = express();
const PORT = process.env.PORT || 8000;

app.set("view engine","ejs");

app.use(express.static(path.join(__dirname,"public")))
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());

app.get('/',(req,res)=>{
    res.render('index');
})

app.post('/register', async (req, res) => {
    try {
        let { name, username, email, age, password } = req.body;

        // Check if user exists
        let existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).send("User already registered");
        }
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Create new user
        let newUser = await userModel.create({
            username,
            name,
            age,
            email,
            password: hash
        });

        // Generate token
        let token = jwt.sign({ email: email, userid: newUser._id }, "secret");

        // Send response once
        res.cookie("token", token);
       // return res.status(201).send("User registered successfully");
       return res.redirect('/profile');

    } catch (err) {
        console.error(err);
        return res.status(500).send("Internal Server Error");
    }
});


app.get('/login',(req,res)=>{
    res.render('login');
})

app.post('/login',async (req,res)=>{
    let {email,password} = req.body;
    let user = await userModel.findOne({email});
    if(!user) res.status(500).send("something went wrong");

    bcrypt.compare(password, user.password , (err,result)=>{
        if(result) {
            let token = jwt.sign({email:email, userid: user._id}, "secret");
            res.cookie("token",token);
            res.status(200).redirect("/profile");
        }
        else res.redirect('/login')
    })
})

app.get('/logout',(req,res)=>{
    res.cookie("token" ,"");
    res.redirect('/login');
})

app.get('/profile',isLoggedIn,async (req,res)=>{
    let user = await userModel.findOne({email: req.user.email}).populate("posts");
    res.render('profile', {user});
})

app.post('/post' , isLoggedIn , async (req,res)=>{
    let user = await userModel.findOne({email: req.user.email});
    let {content} = req.body;
    let post = await postModel.create({
        user: user._id,
        content
    });
    user.posts.push(post._id);
    await user.save();
    res.redirect('/profile');
})

app.get('/like/:id',isLoggedIn , async (req,res)=>{
    let post = await postModel.findOne({_id: req.params.id}).populate("user");
    if (post.likes.indexOf(req.user.userid) === -1) {
        post.likes.push(req.user.userid);
    }
    else{
        post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    }

    await post.save();
    res.redirect('/profile');
});

app.get('/edit/:id',isLoggedIn, async (req,res)=>{
    let post = await postModel.findOne({_id: req.params.id}).populate('user');
    res.render('edit', {post});

})

app.post('/update/:id' , async (req,res)=>{
    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content});
    res.redirect('/profile');

})

app.get('/profile/upload',(req,res)=>{
    res.render('profileupload');

})

app.post('/upload',isLoggedIn,upload.single("image"), async (req,res)=>{
    let user = await userModel.findOne({email: req.user.email});

    if(!req.file){
        return res.redirect('/profile');
    }
    user.profilepic = req.file.filename;
    await user.save();
    res.redirect('/profile')

})


function isLoggedIn(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).redirect("/login");
    }

    try {
        // verify token and decode payload
        const decoded = jwt.verify(token, "secret");
        req.user = decoded; // attach payload to req.user
        next();
    } catch (err) {
        console.error(err);
        return res.status(401).send("Invalid or expired token, please log in again");
    }
}

app.listen(PORT)











