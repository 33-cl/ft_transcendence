#!/usr/bin/env node

/**
 * Script de test pour vérifier la configuration email
 * Usage: node test-email.mjs
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

console.log('🔍 Vérification de la configuration email...\n');

if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
  console.error('❌ ERREUR: Les variables EMAIL_USER et/ou EMAIL_APP_PASSWORD ne sont pas définies dans .env');
  console.log('\n💡 Pour configurer:');
  console.log('1. Créez un fichier .env dans srcs/backend/');
  console.log('2. Ajoutez:');
  console.log('   EMAIL_USER=votre.email@gmail.com');
  console.log('   EMAIL_APP_PASSWORD=votre-app-password-16-caracteres');
  console.log('\n📖 Voir 2FA_SETUP.md pour plus de détails');
  process.exit(1);
}

console.log(`✅ EMAIL_USER défini: ${EMAIL_USER}`);
console.log(`✅ EMAIL_APP_PASSWORD défini: ${EMAIL_APP_PASSWORD.substring(0, 4)}${'*'.repeat(EMAIL_APP_PASSWORD.length - 4)}\n`);

// Configuration du transporteur
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_APP_PASSWORD
  }
});

console.log('📧 Tentative d\'envoi d\'un email de test...\n');

// Email de test
const mailOptions = {
  from: EMAIL_USER,
  to: EMAIL_USER, // Envoi à soi-même
  subject: '🔐 Test 2FA - ft_transcendence',
  text: 'Ceci est un email de test pour vérifier que la configuration 2FA fonctionne correctement.\n\nSi vous recevez cet email, tout est OK! ✅',
  html: `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <h2>🔐 Test 2FA - ft_transcendence</h2>
      <p>Ceci est un email de test pour vérifier que la configuration 2FA fonctionne correctement.</p>
      <p><strong>Si vous recevez cet email, tout est OK! ✅</strong></p>
      <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-top: 20px;">
        <p style="font-size: 24px; font-weight: bold; color: #4CAF50; text-align: center;">123456</p>
        <p style="text-align: center; font-size: 12px; color: #666;">Exemple de code 2FA</p>
      </div>
    </div>
  `
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ ERREUR lors de l\'envoi de l\'email:');
    console.error(error);
    console.log('\n💡 Vérifiez que:');
    console.log('1. EMAIL_USER est correct');
    console.log('2. EMAIL_APP_PASSWORD est un App Password valide (pas votre mot de passe Gmail)');
    console.log('3. Vous avez activé la 2FA sur votre compte Google');
    console.log('4. Le App Password n\'a pas d\'espaces (16 caractères sans espaces)');
    console.log('\n📖 Voir 2FA_SETUP.md pour plus de détails');
    process.exit(1);
  } else {
    console.log('✅ Email envoyé avec succès!');
    console.log(`📨 Message ID: ${info.messageId}`);
    console.log(`📬 Vérifiez votre boîte de réception: ${EMAIL_USER}`);
    console.log('\n🎉 La configuration 2FA fonctionne correctement!');
  }
});
