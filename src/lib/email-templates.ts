// Email templates for license delivery
// Converted from GAS HTML templates to TypeScript functions

interface LicenseEmailParams {
    customerName: string;
    serialKeys: string[];
    productName: string;
    downloadLinks: Record<string, string>;
    pluginUrl?: string;
    includesPlugin: boolean;
}

// =============================================
// RAW FILE COPY TOOL
// =============================================

export function rawFileCopyMacTemplate(params: LicenseEmailParams): string {
    const { customerName, serialKeys, downloadLinks } = params;
    const serialHtml = serialKeys.map((key, i) =>
        `<p style="font-size:18px; color:#f57c00; font-weight:bold; letter-spacing:1px;">${key}${serialKeys.length > 1 ? ` <span style="color:#666; font-size:12px; margin-left:10px;">License #${i + 1}</span>` : ''}</p>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6; font-size: 15px;">
    <div style="margin-bottom: 25px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/Ryanekopram%20logo.png" width="220" style="margin-right:10px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/512.png" width="48" alt="icon">
    </div>

    <p style="font-size:16px;">Halo <b>${customerName}</b>!</p>
    <p style="font-size:16px;">
      Terima kasih banyak atas kepercayaannya untuk membeli software
      <strong>RAW File Copy Tool (Mac)</strong>.
    </p>

    <p style="font-size:16px;">Silakan download software melalui link di bawah ini:</p>
    <p style="font-size:17px; margin: 15px 0;">
      <a href="${downloadLinks['macOS'] || '#'}" style="color:#1155cc; text-decoration:none; font-weight:bold;" target="_blank">Link Download</a> - v2.6.4
    </p>

    <p style="font-size:16px; margin-top:20px;">&#128273; Serial Number:</p>
    ${serialHtml}

    <hr style="margin: 25px 0;">

    <p style="font-size:18px; font-weight:bold;">&#127909; Video Tutorial Cara Install RAW File Copy Tool Mac</p>
    <p><a href="https://www.instagram.com/p/DQWhCrGk8SH/" target="_blank" style="font-size:17px; margin: 15px 0; color:#1155cc; font-weight:bold;">Klik untuk menonton video</a></p>
    <p style="font-size:18px; font-weight:bold;">&#128640; Cara Install RAW File Copy Tool Mac</p>
    <ol style="font-size:16px; padding-left:20px; margin:10px 0;">
      <li>Buka filenya</li>
      <li>Seret aplikasi "RAW File Copy Tool" ke folder <strong>Applications</strong></li>
      <li>Buka folder Applications di Finder</li>
      <li>Buka Aplikasi</li>
      <li>Jika muncul peringatan, klik <em>Open</em></li>
      <li>Masukkan password mac</li>
      <li>Masukkan serial number</li>
      <li>Aplikasi siap digunakan</li>
    </ol>

    <hr style="margin: 25px 0;">

    <p style="font-size:16px;">&#10067; Butuh bantuan atau ada pertanyaan? Langsung hubungi di Instagram
      <a href="https://instagram.com/rawfilecopytool" style="color:#1155cc;">@rawfilecopytool</a>
      atau
      <a href="https://instagram.com/ryanekopram" style="color:#1155cc;">@ryanekopram</a>
    </p>

    <p style="font-size:16px; margin-top:15px;">Enjoy from dev, Ryan Eko &#9889;</p>
</body>
</html>`;
}

export function rawFileCopyMontereyTemplate(params: LicenseEmailParams): string {
    const { customerName, serialKeys, downloadLinks } = params;
    const serialHtml = serialKeys.map((key, i) =>
        `<p style="font-size:18px; color:#f57c00; font-weight:bold; letter-spacing:1px;">${key}${serialKeys.length > 1 ? ` <span style="color:#666; font-size:12px; margin-left:10px;">License #${i + 1}</span>` : ''}</p>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6; font-size: 15px;">
    <div style="margin-bottom: 25px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/Ryanekopram%20logo.png" width="220" style="margin-right:10px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/512.png" width="48" alt="icon">
    </div>

    <p style="font-size:16px;">Halo <b>${customerName}</b>!</p>
    <p style="font-size:16px;">
      Terima kasih banyak atas kepercayaannya untuk membeli software
      <strong>RAW File Copy Tool (Monterey)</strong>.
    </p>

    <p style="font-size:16px;">Silakan download software melalui link di bawah ini:</p>
    <p style="font-size:17px; margin: 15px 0;">
      <a href="${downloadLinks['macOS-Monterey'] || '#'}" style="color:#1155cc; text-decoration:none; font-weight:bold;" target="_blank">Link Download</a> - v2.6.4
    </p>

    <p style="font-size:16px; margin-top:20px;">&#128273; Serial Number:</p>
    ${serialHtml}

    <hr style="margin: 25px 0;">

    <p style="font-size:18px; font-weight:bold;">&#127909; Video Tutorial Cara Install RAW File Copy Tool Mac Monterey</p>
    <p><a href="https://www.instagram.com/p/DQWhCrGk8SH/" target="_blank" style="font-size:17px; margin: 15px 0; color:#1155cc; font-weight:bold;">Klik untuk menonton video</a></p>
    <p style="font-size:18px; font-weight:bold;">&#128640; Cara Install RAW File Copy Tool Mac Monterey</p>
    <ol style="font-size:16px; padding-left:20px; margin:10px 0;">
      <li>Buka filenya</li>
      <li>Seret aplikasi "RAW File Copy Tool" ke folder <strong>Applications</strong></li>
      <li>Buka folder Applications di Finder</li>
      <li>Buka Aplikasi</li>
      <li>Jika muncul peringatan, klik <em>Open</em></li>
      <li>Masukkan password mac</li>
      <li>Masukkan serial number</li>
      <li>Aplikasi siap digunakan</li>
    </ol>

    <hr style="margin: 25px 0;">

    <p style="font-size:16px;">&#10067; Butuh bantuan? Hubungi Instagram
      <a href="https://instagram.com/rawfilecopytool" style="color:#1155cc;">@rawfilecopytool</a>
      atau
      <a href="https://instagram.com/ryanekopram" style="color:#1155cc;">@ryanekopram</a>
    </p>

    <p style="font-size:16px; margin-top:15px;">Enjoy from dev, Ryan Eko &#9889;</p>
</body>
</html>`;
}

export function rawFileCopyWindowsTemplate(params: LicenseEmailParams): string {
    const { customerName, serialKeys, downloadLinks } = params;
    const serialHtml = serialKeys.map((key, i) =>
        `<p style="font-size:18px; color:#f57c00; font-weight:bold; letter-spacing:1px;">${key}${serialKeys.length > 1 ? ` <span style="color:#666; font-size:12px; margin-left:10px;">License #${i + 1}</span>` : ''}</p>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6; font-size: 15px;">
    <div style="margin-bottom: 25px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/Ryanekopram%20logo.png" width="220" style="margin-right:10px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/512.png" width="48" alt="icon">
    </div>

    <p style="font-size:16px;">Halo <b>${customerName}</b>!</p>
    <p style="font-size:16px;">
      Terima kasih banyak atas kepercayaannya untuk membeli software
      <strong>RAW File Copy Tool (Windows)</strong>.
    </p>

    <p style="font-size:16px;">Silakan download software melalui link di bawah ini:</p>
    <p style="font-size:17px; margin: 15px 0;">
      <a href="${downloadLinks['Windows'] || '#'}" style="color:#1155cc; text-decoration:none; font-weight:bold;" target="_blank">Link Download</a> - v2.6.4
    </p>

    <p style="font-size:16px; margin-top:20px;">&#128273; Kode Aktivasi:</p>
    ${serialHtml}

    <hr style="margin: 25px 0;">

    <p style="font-size:18px; font-weight:bold;">&#127909; Video Tutorial Cara Install RAW File Copy Tool Windows</p>
    <p><a href="https://www.instagram.com/p/DPoZAedk8Ot/" target="_blank" style="font-size:17px; margin: 15px 0; color:#1155cc; font-weight:bold;">Klik untuk menonton video</a></p>
    <p style="font-size:18px; font-weight:bold;">&#128640; Cara Install RAW File Copy Tool Windows</p>
    <ol style="font-size:16px; padding-left:20px; margin:10px 0;">
      <li>Buka filenya</li>
      <li>Jika ada warning, klik <i>More info > Open anyway</i></li>
      <li>Install aplikasi seperti biasa</li>
      <li>Masukkan serial number</li>
      <li>Aplikasi siap digunakan</li>
    </ol>

    <hr style="margin: 25px 0;">

    <p style="font-size:16px;">&#10067; Butuh bantuan atau ada pertanyaan? Langsung hubungi di Instagram
      <a href="https://instagram.com/rawfilecopytool" style="color:#1155cc;">@rawfilecopytool</a>
      atau
      <a href="https://instagram.com/ryanekopram" style="color:#1155cc;">@ryanekopram</a>
    </p>

    <p style="font-size:16px; margin-top:15px;">Enjoy from dev, Ryan Eko &#9889;</p>
</body>
</html>`;
}

// Combined template for RAW File Copy — includes all platform download links
export function rawFileCopyAllPlatformsTemplate(params: LicenseEmailParams): string {
    const { customerName, serialKeys, downloadLinks } = params;
    const serialHtml = serialKeys.map((key, i) =>
        `<tr><td style="background:#eee; padding:10px 15px; border-radius:6px;">
          <span style="font-size:18px; color:#f57c00; font-weight:bold; letter-spacing:1px;">${key}</span>
          ${serialKeys.length > 1 ? `<span style="color:#666; font-size:12px; margin-left:10px;">License #${i + 1}</span>` : ''}
        </td></tr>`
    ).join('');

    const macLink = downloadLinks['macOS'];
    const montereyLink = downloadLinks['macOS-Monterey'];
    const windowsLink = downloadLinks['Windows'];

    return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6; font-size: 15px;">
    <div style="margin-bottom: 25px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/Ryanekopram%20logo.png" width="220" style="margin-right:10px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/512.png" width="48" alt="icon">
    </div>

    <p style="font-size:16px;">Halo <b>${customerName}</b>!</p>
    <p style="font-size:16px;">
      Terima kasih banyak atas kepercayaannya untuk membeli software
      <strong>RAW File Copy Tool</strong>.
    </p>

    <p style="font-size:16px;">Silakan download software sesuai platform yang digunakan:</p>
    <div style="margin: 15px 0;">
      ${macLink ? `<p style="font-size:16px; margin: 8px 0;">&#128187; <a href="${macLink}" style="color:#1155cc; text-decoration:none; font-weight:bold;" target="_blank">Download Mac (Ventura+)</a></p>` : ''}
      ${montereyLink ? `<p style="font-size:16px; margin: 8px 0;">&#128187; <a href="${montereyLink}" style="color:#1155cc; text-decoration:none; font-weight:bold;" target="_blank">Download Mac (Monterey)</a></p>` : ''}
      ${windowsLink ? `<p style="font-size:16px; margin: 8px 0;">&#128187; <a href="${windowsLink}" style="color:#1155cc; text-decoration:none; font-weight:bold;" target="_blank">Download Windows</a></p>` : ''}
    </div>

    <div style="margin-top:25px;">
      <p style="font-size:16px; margin-bottom:10px;">&#128273; Serial Number:</p>
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:0 8px;">
        ${serialHtml}
      </table>
    </div>

    <hr style="margin: 25px 0;">

    <p style="font-size:18px; font-weight:bold;">&#127909; Video Tutorial</p>
    <p style="font-size:16px; margin: 8px 0;"><a href="https://www.instagram.com/p/DQWhCrGk8SH/" target="_blank" style="color:#1155cc; font-weight:bold;">Tutorial Install Mac</a></p>
    <p style="font-size:16px; margin: 8px 0;"><a href="https://www.instagram.com/p/DPoZAedk8Ot/" target="_blank" style="color:#1155cc; font-weight:bold;">Tutorial Install Windows</a></p>

    <hr style="margin: 25px 0;">

    <p style="font-size:16px;">&#10067; Butuh bantuan atau ada pertanyaan? Langsung hubungi di Instagram
      <a href="https://instagram.com/rawfilecopytool" style="color:#1155cc;">@rawfilecopytool</a>
      atau
      <a href="https://instagram.com/ryanekopram" style="color:#1155cc;">@ryanekopram</a>
    </p>

    <p style="font-size:16px; margin-top:15px;">Enjoy from dev, Ryan Eko &#9889;</p>
</body>
</html>`;
}

// =============================================
// REALTIME UPLOAD PRO
// =============================================

export function realtimeUploadTemplate(params: LicenseEmailParams): string {
    const { customerName, serialKeys, productName, downloadLinks, pluginUrl, includesPlugin } = params;
    const serialHtml = serialKeys.map((key, i) =>
        `<tr><td style="background:#eee; padding:10px 15px; border-radius:6px;">
          <span style="font-size:18px; color:#f57c00; font-weight:bold; letter-spacing:1px;">${key}</span>
          ${serialKeys.length > 1 ? `<span style="color:#666; font-size:12px; margin-left:10px;">License #${i + 1}</span>` : ''}
        </td></tr>`
    ).join('');

    const mainDownload = downloadLinks['macOS'] || '';
    const showPlugin = includesPlugin && pluginUrl;

    return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6; font-size: 15px;">
    <div style="margin-bottom: 25px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/Ryanekopram%20logo.png" width="220" style="margin-right:10px;">
    </div>

    <p style="font-size:16px;">Halo <b>${customerName}</b>!</p>
    <p style="font-size:16px;">
      Terima kasih banyak atas kepercayaannya untuk membeli software
      <strong>${productName}</strong>.
    </p>

    ${mainDownload ? `
    <div style="margin-bottom:20px;">
      <p style="font-size:16px;">Silakan download software melalui link di bawah ini:</p>
      <p style="font-size:17px; margin: 10px 0;">
        <a href="${mainDownload}" style="color:#1155cc; text-decoration:none; font-weight:bold;" target="_blank">
          &#128190; Download Realtime Upload Pro
        </a>
      </p>
    </div>
    ` : ''}

    ${showPlugin ? `
    <div style="margin-top:20px; padding:15px; background:#f0f7ff; border-radius:8px; border-left:4px solid #007aff;">
      <p style="font-size:16px; margin-top:0;"><strong>&#127873; Bonus: Lightroom Plugin</strong></p>
      <p style="font-size:15px; margin-bottom:10px;">Berikut adalah link download untuk plugin tambahan Anda:</p>
      <p style="font-size:16px; margin: 0;">
        <a href="${pluginUrl}" style="color:#007aff; text-decoration:none; font-weight:bold;" target="_blank">
          &#128229; Download Lightroom Plugin
        </a>
      </p>
    </div>
    ` : ''}

    ${serialKeys.length > 0 ? `
    <div style="margin-top:25px;">
      <p style="font-size:16px; margin-bottom:10px;">&#128273; Serial Number:</p>
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:0 8px;">
        ${serialHtml}
      </table>
    </div>
    ` : ''}

    <hr style="margin: 25px 0;">

    <p style="font-size:18px; font-weight:bold;">&#128640; Cara Install Realtime Upload Pro</p>
    <ol style="font-size:16px; padding-left:20px; margin:10px 0;">
      <li>Download dan buka file .dmg</li>
      <li>Seret aplikasi "Realtime Upload Pro" ke folder Applications</li>
      <li>Buka folder Applications di Finder</li>
      <li>Buka Aplikasi</li>
      <li>Masukkan password mac dan klik Always Allow</li>
      <li>Masukkan serial number dan klik Aktivasi</li>
      <li>Aplikasi siap digunakan</li>
    </ol>

    ${showPlugin ? `
    <hr style="margin: 25px 0;">
    <p style="font-size:18px; font-weight:bold;">&#128640; Cara Install Plugin Realtime Export Lightroom</p>
    <ol style="font-size:16px; padding-left:20px; margin:10px 0;">
      <li>Buka Lightroom Classic</li>
      <li>Pilih Menu File > Plugin Manager</li>
      <li>Pilih Add dan Pilih Plugin (.lrplugin)</li>
      <li>Buka Menu Library</li>
      <li>Pilih Menu Library > Plug-in Extras > Realtime Export</li>
      <li>Menu Plugin akan Muncul</li>
    </ol>
    ` : ''}

    <hr style="margin: 25px 0;">
    <p style="font-size:16px;">&#10067; Butuh bantuan atau ada pertanyaan? Langsung hubungi di Instagram
      <a href="https://instagram.com/ryanekopram" style="color:#1155cc;">@ryanekopram</a> &
      <a href="https://instagram.com/ryaneko.apps" style="color:#1155cc;">@ryaneko.apps</a>
    </p>

    <p style="font-size:16px; margin-top:15px;">Enjoy from dev, Ryan Eko &#9889;</p>
</body>
</html>`;
}

// =============================================
// PHOTO SPLIT EXPRESS
// =============================================

export function photoSplitTemplate(params: LicenseEmailParams): string {
    const { customerName, serialKeys, downloadLinks } = params;
    const serialHtml = serialKeys.map((key, i) =>
        `<tr><td style="background:#eee; padding:10px 15px; border-radius:6px;">
          <span style="font-size:18px; color:#f57c00; font-weight:bold; letter-spacing:1px;">${key}</span>
          ${serialKeys.length > 1 ? `<span style="color:#666; font-size:12px; margin-left:10px;">License #${i + 1}</span>` : ''}
        </td></tr>`
    ).join('');

    const mainDownload = downloadLinks['macOS'] || '';

    return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6; font-size: 15px;">
    <div style="margin-bottom: 25px;">
      <img src="https://raw.githubusercontent.com/ryanekop/RAWFileCopyTool/refs/heads/main/Ryanekopram%20logo.png" width="220" style="margin-right:10px;">
    </div>

    <p style="font-size:16px;">Halo <b>${customerName}</b>!</p>
    <p style="font-size:16px;">
      Terima kasih banyak atas kepercayaannya untuk membeli software
      <strong>Photo Split Express</strong>.
    </p>

    ${mainDownload ? `
    <div style="margin-bottom:20px;">
      <p style="font-size:16px;">Silakan download software melalui link di bawah ini:</p>
      <p style="font-size:17px; margin: 10px 0;">
        <a href="${mainDownload}" style="color:#1155cc; text-decoration:none; font-weight:bold;" target="_blank">
          &#128190; Download Photo Split Express
        </a>
      </p>
    </div>
    ` : ''}

    ${serialKeys.length > 0 ? `
    <div style="margin-top:25px;">
      <p style="font-size:16px; margin-bottom:10px;">&#128273; Serial Number:</p>
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:0 8px;">
        ${serialHtml}
      </table>
    </div>
    ` : ''}

    <hr style="margin: 25px 0;">

    <p style="font-size:18px; font-weight:bold;">&#128640; Cara Install Photo Split Express</p>
    <ol style="font-size:16px; padding-left:20px; margin:10px 0;">
      <li>Download dan buka file .dmg</li>
      <li>Seret aplikasi "Photo Split Express" ke folder Applications</li>
      <li>Buka folder Applications di Finder</li>
      <li>Buka Aplikasi</li>
      <li>Masukkan password mac dan klik Always Allow</li>
      <li>Masukkan serial number dan klik Aktivasi</li>
      <li>Aplikasi siap digunakan</li>
    </ol>

    <hr style="margin: 25px 0;">
    <p style="font-size:16px;">&#10067; Butuh bantuan atau ada pertanyaan? Langsung hubungi di Instagram
      <a href="https://instagram.com/ryanekopram" style="color:#1155cc;">@ryanekopram</a> &
      <a href="https://instagram.com/ryaneko.apps" style="color:#1155cc;">@ryaneko.apps</a>
    </p>

    <p style="font-size:16px; margin-top:15px;">Enjoy from dev, Ryan Eko &#9889;</p>
</body>
</html>`;
}

// =============================================
// TEMPLATE SELECTOR
// =============================================

export function getEmailHtml(
    productSlug: string,
    params: LicenseEmailParams
): string {
    switch (productSlug) {
        case 'raw-file-copy-tool':
            // At purchase time we don't know the platform, send all-platforms email
            return rawFileCopyAllPlatformsTemplate(params);
        case 'realtime-upload-pro':
            return realtimeUploadTemplate(params);
        case 'photo-split-express':
            return photoSplitTemplate(params);
        default:
            // Fallback: use realtime upload template as generic
            return realtimeUploadTemplate(params);
    }
}

export function getEmailSubject(productSlug: string, includesPlugin: boolean): string {
    switch (productSlug) {
        case 'raw-file-copy-tool':
            return '🔑 Lisensi RAW File Copy Tool';
        case 'realtime-upload-pro':
            return includesPlugin
                ? '🔑 Lisensi Realtime Upload Pro + Plugin'
                : '🔑 Lisensi Realtime Upload Pro';
        case 'photo-split-express':
            return '🔑 Lisensi Photo Split Express';
        default:
            return '🔑 Lisensi Software Anda';
    }
}
