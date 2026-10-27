/** Canonical server error codes stay independent of the displayed language. */
export const ACCOUNT_ERROR_SOURCES:Readonly<Record<string,string>>={
  invalid_username:'El nombre de usuario debe tener 3-20 caracteres alfanuméricos, guiones o guiones bajos.',
  username_taken:'Ese nombre de usuario ya está en uso.',
  invalid_credentials:'El correo o la contraseña son incorrectos.',
  email_already_registered:'Ya existe una cuenta con ese correo. Inicia sesión.',
  unauthorized:'Tu sesión ha caducado. Vuelve a ingresar.',
};
export const ACCOUNT_TRANSLATIONS:readonly (readonly [string,string,string])[]=[
  ['Continuar con','Continue with','Continuer avec'],
  ['Historia','Story','Article'],
  ['El nombre de usuario debe tener 3-20 caracteres alfanuméricos, guiones o guiones bajos.','Your username must contain 3–20 letters, numbers, hyphens or underscores.','Le nom d’utilisateur doit contenir de 3 à 20 lettres, chiffres, tirets ou traits de soulignement.'],
  ['Ese nombre de usuario ya está en uso.','That username is already in use.','Ce nom d’utilisateur est déjà utilisé.'],
  ['El correo o la contraseña son incorrectos.','The email or password is incorrect.','L’adresse e-mail ou le mot de passe est incorrect.'],
  ['Ya existe una cuenta con ese correo. Inicia sesión.','An account with that email already exists. Sign in.','Un compte existe déjà avec cette adresse. Connectez-vous.'],
  ['Tu sesión ha caducado. Vuelve a ingresar.','Your session has expired. Sign in again.','Votre session a expiré. Reconnectez-vous.'],
  ['Envía un correo electrónico y una contraseña.','Enter an email address and password.','Saisissez une adresse e-mail et un mot de passe.'],
  ['Ingresa un correo electrónico válido.','Enter a valid email address.','Saisissez une adresse e-mail valide.'],
  ['Ingresa una contraseña.','Enter a password.','Saisissez un mot de passe.'],
  ['La contraseña debe tener al menos {count} caracteres.','The password must contain at least {count} characters.','Le mot de passe doit contenir au moins {count} caractères.'],
  ['La contraseña no puede superar los {count} caracteres.','The password cannot exceed {count} characters.','Le mot de passe ne peut pas dépasser {count} caractères.'],
];
