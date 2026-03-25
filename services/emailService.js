import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendVerificationEmail(toEmail, token) {
    const verifyUrl = `${process.env.BASE_URL}/verify-email?token=${token}`

    await resend.emails.send({
        from: 'TRAFFIX MX <onboarding@resend.dev>',
        to: toEmail,
        subject: 'Verifica tu correo – TRAFFIX MX',
        html: `
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8">
          <style>
            body{margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',sans-serif}
            .wrapper{max-width:560px;margin:40px auto;background:#111;border:1px solid #f5c518;border-radius:12px;overflow:hidden}
            .header{background:#f5c518;padding:28px 32px}
            .header h1{margin:0;color:#0a0a0a;font-size:22px;font-weight:800;letter-spacing:2px}
            .body{padding:36px 32px;color:#e0e0e0;line-height:1.7}
            .body h2{color:#f5c518;font-size:18px;margin-top:0}
            .btn{display:inline-block;margin:24px 0;padding:14px 32px;background:#f5c518;color:#0a0a0a;font-weight:700;border-radius:6px;text-decoration:none;font-size:15px}
            .footer{padding:20px 32px;border-top:1px solid #222;color:#555;font-size:12px}
            .link{color:#f5c518;word-break:break-all;font-size:13px}
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="header"><h1>⚡ TRAFFIX MX</h1></div>
            <div class="body">
              <h2>Confirma tu dirección de correo</h2>
              <p>Hola, gracias por registrarte. Haz clic en el botón para activar tu cuenta:</p>
              <a class="btn" href="${verifyUrl}">Verificar mi correo</a>
              <p>Este enlace expira en <strong>24 horas</strong>.</p>
              <p style="color:#666;font-size:13px">Si no puedes hacer clic, copia y pega este enlace:</p>
              <p class="link">${verifyUrl}</p>
            </div>
            <div class="footer">Si no creaste esta cuenta, ignora este mensaje.</div>
          </div>
        </body>
        </html>`
    })
}

export async function sendPasswordResetEmail(toEmail, token) {
    const resetUrl = `${process.env.BASE_URL}/reset-password?token=${token}`

    await resend.emails.send({
        from: 'TRAFFIX MX <onboarding@resend.dev>',
        to: toEmail,
        subject: 'Recupera tu contraseña – TRAFFIX MX',
        html: `
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8">
          <style>
            body{margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',sans-serif}
            .wrapper{max-width:560px;margin:40px auto;background:#111;border:1px solid #f5c518;border-radius:12px;overflow:hidden}
            .header{background:#f5c518;padding:28px 32px}
            .header h1{margin:0;color:#0a0a0a;font-size:22px;font-weight:800;letter-spacing:2px}
            .body{padding:36px 32px;color:#e0e0e0;line-height:1.7}
            .body h2{color:#f5c518;font-size:18px;margin-top:0}
            .btn{display:inline-block;margin:24px 0;padding:14px 32px;background:#f5c518;color:#0a0a0a;font-weight:700;border-radius:6px;text-decoration:none;font-size:15px}
            .footer{padding:20px 32px;border-top:1px solid #222;color:#555;font-size:12px}
            .link{color:#f5c518;word-break:break-all;font-size:13px}
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="header"><h1>⚡ TRAFFIX MX</h1></div>
            <div class="body">
              <h2>Restablece tu contraseña</h2>
              <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
              <a class="btn" href="${resetUrl}">Restablecer contraseña</a>
              <p>Este enlace expira en <strong>1 hora</strong>.</p>
              <p style="color:#666;font-size:13px">Si no puedes hacer clic, copia y pega este enlace:</p>
              <p class="link">${resetUrl}</p>
            </div>
            <div class="footer">Si no solicitaste esto, ignora este mensaje.</div>
          </div>
        </body>
        </html>`
    })
}
