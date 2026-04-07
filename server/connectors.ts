const SUPPORTED_CONNECTORS: Record<string, { name: string; description: string; operations: string[] }> = {
  postgres: { name: "PostgreSQL", description: "Connect to PostgreSQL databases", operations: ["query", "schema"] },
  mysql: { name: "MySQL", description: "Connect to MySQL databases", operations: ["query", "schema"] },
  redis: { name: "Redis", description: "Connect to Redis cache", operations: ["get", "set", "delete"] },
  mongodb: { name: "MongoDB", description: "Connect to MongoDB databases", operations: ["find", "insert", "update", "delete"] },
};

export function getConnectorKey(connectorType: string): string {
  return `CONNECTOR_${connectorType.toUpperCase()}_URL`;
}

export function getSupportedConnectors(): typeof SUPPORTED_CONNECTORS {
  return SUPPORTED_CONNECTORS;
}

export function getConnectorOperations(connectorType: string): string[] {
  return SUPPORTED_CONNECTORS[connectorType]?.operations || [];
}

export async function executeConnectorOperation(
  connectorType: string,
  operation: string,
  params: any,
): Promise<any> {
  throw new Error(`Connector ${connectorType} operation ${operation} not implemented`);
}

export function getConnectorDescription(connectorType: string): string {
  return SUPPORTED_CONNECTORS[connectorType]?.description || "Unknown connector";
}
