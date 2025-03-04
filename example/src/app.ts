import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import responseTime from 'response-time';
import pick from 'lodash/pick';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import jwt from 'jsonwebtoken';
import type {VerifyErrors, JwtPayload} from 'jsonwebtoken';

import {jwtSecretKey, jwtAlgorithm} from './config';
import {PORT} from './config';
// @ts-ignore
import sdk from '../../index';
import SwaggerOptions from './swagger';
import BucketRouter from './routes/Bucket';

const app = express();
const swaggerSpec = swaggerJSDoc(SwaggerOptions);

/** 静态资源 */
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../node_modules/amis/sdk')));

/** 请求中间件 */
app.use(cors({origin: '*', credentials: false}));
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
/** 响应时间 */
app.use(responseTime());
/** 请求体 */
app.use(bodyParser.json());
app.use(cookieParser());
/** 全局拦截器 */
app.use((req, res, next) => {
  const token = req.cookies['token'];

  if (req.url === '/login' || req.url === '/api/login') {
    next();
  } else {
    if (!token) {
      console.log('Authentication Token not found and redirect to login page.');
      return res.redirect('/login');
    }

    // @ts-ignore
    jwt.verify(token, jwtSecretKey, (error: VerifyErrors, decode: JwtPayload) => {
      if (error) {
        return res.status(403).send('Authentication failed, please login again.');
      } else {
        const config = pick(decode, ['endpoint', 'credentials']);
        const bosClient = new sdk.BosClient(config);

        res.locals.client = bosClient;
        next();
      }
    });
  }
});

/** 登录模块 */
app.use('/login', express.static(path.join(__dirname, '../public/login.html')));
app.post('/api/login', (req, res) => {
  const {endpoint, ak, sk} = req.body;

  if (!endpoint || !sk || !sk) {
    return res.status(401).json({status: 401, message: 'Authentication failed', data: null});
  }

  const token = jwt.sign(
    {
      endpoint,
      credentials: {ak, sk}
    },
    jwtSecretKey,
    {
      algorithm: jwtAlgorithm,
      expiresIn: '90 days'
    }
  );

  res.cookie('token', token);
  return res.status(200).json({token, status: 0, message: 'Login Successfully'});
});

/** API路由 */
app.use('/', BucketRouter);
app.use(
  '/api-docs',
  swaggerUI.serve,
  swaggerUI.setup(swaggerSpec, {
    // explorer: true,
    // customJs: '',
    customSiteTitle: 'Bos OpenAPI调试',
    customfavIcon: 'https://bce.bdstatic.com/img/favicon.ico'
    // customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-themes@3.0.0/themes/3.x/theme-newspaper.css'
  })
);

app.listen(PORT, () => {
  console.debug('✨ Server tart successfully!');
  console.debug('Server listening on port: ' + PORT);
});
