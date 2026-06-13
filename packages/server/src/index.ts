import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { loadConfig, getConfig } from './config.js'
import { authMiddleware } from './auth.js'
import { subdomainMiddleware } from './subdomain.js'
import { migrate } from './db.js'
import { setupWebSocket } from './ws.js'
import { setupAdminWebSocket } from './admin-ws.js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createServer as createHttpsServer } from 'https'
import logger from './logger.js'
import authRouter from './routes/auth.js'
import brandingRouter from './routes/branding.js'
import guideRouter from './routes/guide.js'
import submissionsRouter from './routes/submissions.js'
import connectionsRouter from './routes/connections.js'
import sandboxRouter from './routes/sandbox.js'
import adminRouter from './routes/admin.js'
import adminCompaniesRouter from './routes/admin-companies.js'
import adminUsersRouter from './routes/admin-users.js'
import adminProjectTypesRouter from './routes/admin-project-types.js'
import adminTaskTemplatesRouter from './routes/admin-task-templates.js'
import adminCustomersRouter from './routes/admin-customers.js'
import adminProjectsRouter from './routes/admin-projects.js'
import adminSubmissionsRouter from './routes/admin-submissions.js'
import adminLeadStagesRouter from './routes/admin-lead-stages.js'
import adminRolesRouter from './routes/admin-roles.js'
import adminContactsRouter from './routes/admin-contacts.js'
import adminActivitiesRouter from './routes/admin-activities.js'
import adminLeadsRouter from './routes/admin-leads.js'
import adminDomainsRouter from './routes/admin-domains.js'
import adminAgreementsRouter from './routes/admin-agreements.js'
import adminCustomFieldsRouter from './routes/admin-custom-fields.js'
import adminCustomValuesRouter from './routes/admin-custom-values.js'
import adminColumnPreferencesRouter from './routes/admin-column-preferences.js'
import companyMakerRouter from './routes/company-maker.js'
import adminTerritoryRouter from './routes/admin-territory.js'
import adminDirectoryContactsRouter from './routes/admin-directory-contacts.js'
import adminBanksRouter from './routes/admin-banks.js'
import adminFieldSettingsRouter from './routes/admin-field-settings.js'
import adminDuplicatesRouter from './routes/admin-duplicates.js'
import adminFinanceRouter from './routes/admin-finance.js'
import fieldAuthRouter from './routes/field-auth.js'
import fieldRouter from './routes/field.js'
import adminFieldRouter from './routes/admin-field.js'
import adminGeoRouter from './routes/admin-geo.js'
import adminMapsRouter from './routes/admin-maps.js'
import adminTestWorkspaceRouter from './routes/admin-test-workspace.js'
import adminDevStudioRouter from './routes/admin-dev-studio.js'
import adminAutomationsRouter from './routes/admin-automations.js'
import adminFormsRouter from './routes/admin-forms.js'
import publicFormsRouter from './routes/public-forms.js'

loadConfig()
migrate()

const app = express()
const server = createServer(app)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://code.jquery.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', ...(process.env.DEV_MODE === 'true' || process.env.DEV_MODE === '1' ? ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'] : [])],
      connectSrc: ["'self'", ...(process.env.DEV_MODE === 'true' || process.env.DEV_MODE === '1' ? ['ws://localhost:3001'] : [])],
      fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
    },
  },
}))

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : undefined
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined))

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

app.use(express.json({ limit: '10mb' }))

app.use('/uploads', express.static(getConfig().storageDir))

// Request logging middleware
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.originalUrl, ip: req.ip }, 'incoming request')
  next()
})

// Auth routes (no auth required)
app.use('/api/auth', authRouter)
app.use('/api/field/auth', fieldAuthRouter)

// Subdomain middleware
app.use(subdomainMiddleware)

// Auth middleware for all /api routes except /api/auth
app.use('/api', authMiddleware)

// Strict rate limit on mutations
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/branding', brandingRouter)
app.use('/api/guide', guideRouter)
app.use('/api/submissions', strictLimiter, submissionsRouter)
app.use('/api/connections', strictLimiter, connectionsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/admin/companies', adminCompaniesRouter)
app.use('/api/admin/users', adminUsersRouter)
app.use('/api/admin/project-types', adminProjectTypesRouter)
app.use('/api/admin/task-templates', adminTaskTemplatesRouter)
app.use('/api/admin/customers', adminCustomersRouter)
app.use('/api/admin/projects', adminProjectsRouter)
app.use('/api/admin/submissions', adminSubmissionsRouter)
app.use('/api/admin/lead-stages', adminLeadStagesRouter)
app.use('/api/admin/contacts', adminContactsRouter)
app.use('/api/admin/activities', adminActivitiesRouter)
app.use('/api/admin/leads', adminLeadsRouter)
app.use('/api/admin/roles', adminRolesRouter)
app.use('/api/admin/agreements', adminAgreementsRouter)
app.use('/api/admin/custom-fields', adminCustomFieldsRouter)
app.use('/api/admin/custom-values', adminCustomValuesRouter)
app.use('/api/admin/column-preferences', adminColumnPreferencesRouter)
app.use('/api/admin/domains', adminDomainsRouter)
app.use('/api/admin/company-maker', companyMakerRouter)
app.use('/api/admin/territory', adminTerritoryRouter)
app.use('/api/admin/geo', adminGeoRouter)
app.use('/api/admin/maps', strictLimiter, adminMapsRouter)
app.use('/api/admin/test-workspace', strictLimiter, adminTestWorkspaceRouter)
if (getConfig().devMode) {
  app.use('/api/admin/dev-studio', strictLimiter, adminDevStudioRouter)
}
app.use('/api/admin/directory-contacts', adminDirectoryContactsRouter)
app.use('/api/admin/banks', adminBanksRouter)
app.use('/api/admin/field-settings', adminFieldSettingsRouter)
app.use('/api/admin/duplicates', adminDuplicatesRouter)
app.use('/api/admin/finance', adminFinanceRouter)
app.use('/api/admin/forms', adminFormsRouter)
app.use('/api/admin/automations', strictLimiter, adminAutomationsRouter)
app.use('/api/f', publicFormsRouter)
app.use('/api/field', strictLimiter, fieldRouter)
app.use('/api/admin/field', adminFieldRouter)

if (getConfig().devMode) {
  app.use('/sandbox', sandboxRouter)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, data: { status: 'healthy', mode: getConfig().devMode ? 'dev' : 'production' } })
})

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Internal server error')
  res.status(500).json({ ok: false, error: 'Internal server error' })
})

const wsHub = setupWebSocket(server)
setupAdminWebSocket(server)

const PORT = getConfig().port

// Serve admin build for subdomain-based access
const __dirname = dirname(fileURLToPath(import.meta.url))
const adminDist = join(__dirname, '..', '..', 'admin', 'dist')
if (existsSync(adminDist)) {
  app.use(express.static(adminDist))
  // SPA fallback — serve index.html for any non-API route
  // Public form pages
  app.get('/f/:slug', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Form</title>
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.14.1/jquery-ui.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/formbuilder@3.22.1/dist/form-render.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/formbuilder@3.22.1/dist/form-render.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;padding:20px}
.form-wrap{max-width:700px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);padding:24px}
.form-wrap h1{font-size:1.5rem;margin-bottom:8px}
.form-wrap p{color:#666;margin-bottom:16px}
#form-container .form-group{margin-bottom:16px}
#form-container label{display:block;font-weight:600;margin-bottom:4px;font-size:.875rem}
#form-container input,#form-container select,#form-container textarea{width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;font-size:.875rem}
#form-container .required:after{content:' *';color:#e53e3e}
.btn-submit{background:#2563eb;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:1rem;cursor:pointer;margin-top:16px}
.btn-submit:hover{background:#1d4ed8}
.thank-you{text-align:center;padding:40px 20px}
.thank-you h2{font-size:1.5rem;margin-bottom:8px;color:#16a34a}
.thank-you p{color:#666}
.loading{text-align:center;padding:40px;color:#666}
</style>
</head>
<body>
<div class="form-wrap"><div id="form-container"><div class="loading">Loading form...</div></div></div>
<script>
$(function(){
  var slug = window.location.pathname.split('/').pop();
  $.getJSON('/api/f/' + slug, function(res){
    if(!res.ok) { $('#form-container').html('<p>Form not found.</p>'); return; }
    var data = res.data;
    $('.form-wrap').prepend('<h1>' + $('<span>').text(data.name).html() + '</h1>' + (data.description ? '<p>' + $('<span>').text(data.description).html() + '</p>' : ''));
    try {
      var fbData = JSON.parse(data.schemaJson);
      $('#form-container').formRender({ formData: fbData, dataType: 'json' });
    } catch(e) {
      $('#form-container').html('<p>Error loading form.</p>');
      return;
    }
    var btn = $('<button class="btn-submit">Submit</button>').appendTo('#form-container');
    btn.on('click', function(){
      var formData = $('#form-container').formRender('userData');
      var $btn = $(this).prop('disabled',true).text('Submitting...');
      $.ajax({
        url: '/api/f/' + slug,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ responseJson: formData }),
        success: function(){ $('.form-wrap').html('<div class="thank-you"><h2>Thank You!</h2><p>Your response has been submitted.</p></div>'); },
        error: function(){ $btn.prop('disabled',false).text('Submit'); alert('Submission failed. Please try again.'); }
      });
    });
  }).fail(function(){ $('#form-container').html('<p>Form not found.</p>'); });
});
</script>
</body>
</html>`)
  })

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/sandbox') || req.path.startsWith('/ws') || req.path.startsWith('/f/')) {
      return next()
    }
    res.sendFile(join(adminDist, 'index.html'))
  })
}

server.listen(PORT, () => {
  logger.info({ port: PORT, devMode: getConfig().devMode }, 'Server started')
  logger.info({ wsUrl: `ws://localhost:${PORT}/ws/submissions`, adminWsUrl: `ws://localhost:${PORT}/ws/admin` }, 'WebSocket server')
  if (getConfig().devMode) {
    logger.info({ sandboxUrl: `http://localhost:${PORT}/sandbox` }, 'Sandbox enabled')
  }
})

// Optional HTTPS server for subdomain dev
const certDir = join(__dirname, '..', 'certs')
const keyPath = join(certDir, 'localhost-key.pem')
const certPath = join(certDir, 'localhost.pem')
if (existsSync(keyPath) && existsSync(certPath)) {
  const httpsServer = createHttpsServer({
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  }, app)
  httpsServer.listen(443, () => {
    logger.info({ httpsUrl: 'https://*.localhost:443' }, 'HTTPS server started')
  })
}

export { wsHub }
