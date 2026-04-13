import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { storage } from '../storage';

const execAsync = promisify(exec);

export interface BuildConfig {
  projectId: number;
  projectName: string;
  deploymentId: string;
  language: string;
}

export class ContainerBuilder {
  private registryUrl: string = 'registry.e-code.ai';

  async buildImage(config: BuildConfig): Promise<string> {
    const project = await storage.getProject(config.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const projectDir = path.join(process.cwd(), 'project-workspaces', String(config.projectId));
    const imageName = `${this.registryUrl}/${config.projectName.toLowerCase().replace(/\s+/g, '-')}-${config.deploymentId}:latest`;

    // Create Dockerfile based on language
    const dockerfile = this.generateDockerfile(config.language, project);
    const dockerfilePath = path.join(projectDir, 'Dockerfile');
    await fs.writeFile(dockerfilePath, dockerfile);

    try {
      // Build the Docker image
      await execAsync(`docker build -t ${imageName} ${projectDir}`);

      // Push to registry
      await execAsync(`docker push ${imageName}`);

      return imageName;
    } catch (error) {
      console.error('Docker build failed:', error);
      throw new Error(`Failed to build container: ${error.message}`);
    } finally {
      // Clean up Dockerfile
      await fs.unlink(dockerfilePath).catch((err) => {
        console.warn('[ContainerBuilder] Failed to clean up Dockerfile:', dockerfilePath, err?.message);
      });
    }
  }

  private generateDockerfile(language: string, project: any): string {
    const dockerfiles: Record<string, string> = {
      nodejs: `
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
`,
      python: `
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["python", "app.py"]
`,
      java: `
FROM openjdk:17-jdk-slim AS build

WORKDIR /app

# Copy source code
COPY . .

# Build the application
RUN javac -d out src/main/java/**/*.java

FROM openjdk:17-jre-slim

WORKDIR /app

# Copy compiled classes
COPY --from=build /app/out .

# Expose port
EXPOSE 3000

# Run the application
CMD ["java", "-cp", ".", "Main"]
`,
      go: `
FROM golang:1.21-alpine AS build

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN go build -o main .

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary
COPY --from=build /app/main .

# Expose port
EXPOSE 3000

# Run the application
CMD ["./main"]
`,
      rust: `
FROM rust:1.75 AS build

WORKDIR /app

# Copy cargo files
COPY Cargo.toml Cargo.lock ./

# Build dependencies
RUN cargo build --release

# Copy source code
COPY . .

# Build application
RUN cargo build --release

FROM debian:bookworm-slim

WORKDIR /app

# Copy binary
COPY --from=build /app/target/release/app .

# Expose port
EXPOSE 3000

# Run the application
CMD ["./app"]
`,
      php: `
FROM php:8.2-apache

# Enable mod_rewrite
RUN a2enmod rewrite

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql

# Copy application code
COPY . /var/www/html/

# Set proper permissions
RUN chown -R www-data:www-data /var/www/html

# Expose port
EXPOSE 80

# Apache runs automatically
`,
      ruby: `
FROM ruby:3.2-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Copy Gemfile
COPY Gemfile Gemfile.lock ./

# Install gems
RUN bundle install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["ruby", "app.rb"]
`,
      dotnet: `
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /app

# Copy project file
COPY *.csproj ./

# Restore dependencies
RUN dotnet restore

# Copy source code
COPY . .

# Build application
RUN dotnet publish -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

# Copy published files
COPY --from=build /app/out .

# Expose port
EXPOSE 80

# Run the application
ENTRYPOINT ["dotnet", "app.dll"]
`,
    };

    // Return the appropriate Dockerfile or a default one
    return dockerfiles[language] || dockerfiles.nodejs;
  }
}

export const containerBuilder = new ContainerBuilder();