# Paperclip Dashboard Service
# Standalone HITL governance interface

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy Paperclip source
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start Paperclip
CMD ["npm", "start"]
