var express = require('express');
var app = express();

//Load modules
var sqlite3         =       require('sqlite3').verbose();
var db              =       new sqlite3.Database('./mydb.db');

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

//INSCRIPTION | CONNEXION
//Inscription
app.post('/register', function (req, res) {
  var identifiant = req.body.identifiant;
  var mot_de_passe = req.body.mot_de_passe;
  var code_magasin = req.body.code_magasin;

  if(code_magasin == "null")
  {
    db.run("INSERT into Utilisateur(identifiant,mot_de_passe,id_magasin) " +
    "VALUES ('"+identifiant+"','"+mot_de_passe+"','0')");
  }
  else
  {
    //Obtenir le magasin correspondant au code ou retourner null
  }

  res.send('Hello World!');
})

//createMagasin
app.post('/createStore', function (req, res) {
  var nom_magasin = req.body.nom_magasin;

  //Check if magasin exist already
  db.all("SELECT * FROM Magasin WHERE nom='"+nom_magasin+"'",function(err,rows){
    //rows contain values while errors, well you can figure out.
    if(rows !== undefined && rows.length == 0)
    {
      //Genere code for magasin admin to give to magasin owner
      var code = generateCode();
      //insert the new store with a code
      db.run("INSERT into Magasin(nom,code,image) VALUES ('"+nom_magasin+"','"+code+"','null')");
      res.send('ok');
    }
    else //if the store already exists
    {
      res.send('not ok');
    }
  });
})

//select all coupons from store
app.get('/getAllCouponsFromStore', function (req, res) {

  db.all("SELECT nom, reduction, delai, quantite FROM Coupon JOIN Magasin ON Coupon.id_magasin = Magasin.id_magasin",function(err,rows){
    if(rows !== undefined)
    {
      res.send(rows);
    }
    else
    {
      throw err;
    }
  });
})

//insert new coupon in store
app.post('/addCouponFromStore', function (req, res) {
  var reduction = req.body.reduction;
  var delai = req.body.delai;
  var quantite = req.body.quantite;
  var id_magasin = req.body.id_magasin;

  db.run("INSERT INTO Coupon (reduction,delai,quantite,id_magasin) VALUES ('"+reduction+"','"+delai+"','"+quantite+"', '"+id_magasin+"')");
  res.send("ok");
})

//select all  my coupon
app.get('/getMyCoupons', function (req, res) {
  var id_utilisateur = req.body.id_utilisateur;

  db.all("SELECT nom, reduction, delai FROM Coupon_utilisateur JOIN Magasin ON Coupon.id_magasin = Magasin.id_magasin WHERE id_utilisateur='"+id_utilisateur+"'",function(err,rows){
    if(rows !== undefined)
    {
      res.send(rows);
    }
    else
    {
      throw err;
    }
  });
})

//select all coupons from user
app.get('/getAllCouponsFromUser', function (req, res) {
  //NEED SECURITY CHECK IF USER HAS COUPON
  db.all("SELECT id_utilisateur, nom, reduction, delai FROM Coupon JOIN Magasin ON Coupon.id_magasin = Magasin.id_magasin WHERE id_utilisateur != '"+null+"'",function(err,rows){
    if(rows !== undefined)
    {
      res.send(rows);
    }
    else
    {
      throw err;
    }
  });
})

//insert new coupon from a user
app.post('/addCouponFromUser', function (req, res) {
  var id_coupon = req.body.id_coupon;
  var id_utilisateur = req.body.id_utilisateur;

  db.run("UPDATE Coupon SET id_utilisateur='"+id_utilisateur+"' WHERE id_coupon='"+id_coupon+"'");
  res.send("ok");
})

//insert new coupon from a user
app.post('/takeCoupon', function (req, res) {
  var id_coupon = req.body.id_coupon;
  var id_utilisateur = req.body.id_utilisateur;


  db.all("SELECT quantite FROM Coupon WHERE id_coupon="+id_coupon+";",function(err,rows){
    //get the number of coupon
    var quantite = rows[0].quantite;
    if(quantite > 0) //if there is enought coupon
    {
      //we check if the user doesn't have already one coupon of this kind
      db.all("SELECT id_coupon FROM Coupon_utilisateur WHERE id_utilisateur="+id_utilisateur+" AND id_coupon="+id_coupon+";",function(err,rowsCoupon){
        if(rowsCoupon.length === 0)
        {
          quantite -= 1; //We get one
          db.run("UPDATE Coupon SET quantite='"+quantite+"' WHERE id_coupon='"+id_coupon+"'");
          //We add the coupon in our user database
          db.run("INSERT INTO Coupon_utilisateur(id_coupon, id_utilisateur)  VALUES('"+id_coupon+"','"+id_utilisateur+"')");
          res.send("ok");
        }
        else {
          res.send("Vous avez déjà un exemplaire de ce coupon.")
        }
      });
    }
    else {
      res.send("Il n'y pas de coupon disponible.");
    }
  });
})

//Connexion
app.get('/login', function (req, res) {
  var identifiant = req.body.identifiant;
  var mot_de_passe = req.body.mot_de_passe;

  db.all("SELECT * from Utilisateur where identifiant="+identifiant+" AND mot_de_passe="+mot_de_passe,function(err,rows){
    //rows contain values while errors, well you can figure out.
    if(rows =="")
    res.send('ok');
  });

  //Si les informations de connexion sont bonnes

})

function generateCode()
{
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var tokenGenerate = '';
  for(var i = 0; i< 8; i++)
  {
    var nbAlea = Math.random()*25;
    tokenGenerate += characters.charAt(nbAlea);
  }
  return  tokenGenerate;
}

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
})



//Perform SELECT Operation
//db.all("SELECT * from blah blah blah where this="+that,function(err,rows){
//rows contain values while errors, well you can figure out.
//});

//Perform INSERT operation.

//Perform DELETE operation
//db.run("DELETE * from table_name where condition");

//Perform UPDATE operation
//db.run("UPDATE table_name where condition");
