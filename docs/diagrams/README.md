# 📊 Digital House - System Diagrams

This directory contains all the system diagrams and flowcharts for the Digital House platform.

## 📁 Files

### `digital-house-flow.mmd`
**Main System Flow Diagram**
- Shows the complete user journey from reservation to check-out
- **UPDATED**: Now includes Sub-Vault system for date-specific bookings
- Includes auction system and new payment distribution logic
- Displays master access code inheritance from parent vaults

### `subvault-architecture.mmd`
**Sub-Vault Architecture Diagram** ⭐ NEW
- Comprehensive view of the Parent Vault → Sub-Vault relationship
- Shows how multiple users can book different dates simultaneously
- Illustrates the booking flow and state management
- Demonstrates property inheritance and access code system

### `sequenceDiagram.mmd`
**Sequence Diagram**
- Detailed interaction between all system components
- Shows the complete process with cession (citizen value)
- Includes all actors: Hotel, Factory, Vault, Users, PYUSD Token, Digital House
- **NOTE**: Needs updating for Sub-Vault system

## 🔧 How to View

### Option 1: Mermaid Live Editor
1. Copy the content of any `.mmd` file
2. Go to [Mermaid Live Editor](https://mermaid.live/)
3. Paste the content
4. View the rendered diagram

### Option 2: VS Code Extension
1. Install the "Mermaid Preview" extension
2. Open any `.mmd` file
3. Use `Ctrl+Shift+P` → "Mermaid Preview"

### Option 3: GitHub
GitHub automatically renders Mermaid diagrams in markdown files.

## 📝 Creating New Diagrams

When creating new diagrams:

1. Use `.mmd` extension for Mermaid files
2. Follow the naming convention: `descriptive-name.mmd`
3. Update this README with the new diagram description
4. Reference the diagram in the main project README

## 🎨 Diagram Guidelines

- Use consistent colors and styling
- Include clear labels and descriptions
- Keep diagrams focused on specific processes
- Update diagrams when system changes
