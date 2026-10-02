import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/configuration";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  const prefix = config.get("apiPrefix", { infer: true });

  app.setGlobalPrefix(prefix, { exclude: [".well-known/jwks.json"] });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const origins = config.get("corsOrigins", { infer: true });
  app.enableCors({ origin: origins.length ? origins : false, credentials: true });

  const swagger = new DocumentBuilder()
    .setTitle("MeliAuth API")
    .setDescription("Central authentication service")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));

  await app.listen(config.get("port", { infer: true }));
}

void bootstrap();
