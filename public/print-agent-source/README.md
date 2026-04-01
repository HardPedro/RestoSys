# Agente de Impressão Local

Este é um agente local para Windows que permite a impressão silenciosa de pedidos vindos do sistema web.

## Como Compilar

1. Instale o [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0).
2. Abra o terminal ou prompt de comando nesta pasta.
3. Execute o comando:
   ```bash
   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
   ```
4. O executável `PrintAgent.exe` será gerado na pasta `bin\Release\net8.0-windows\win-x64\publish\`.

## Como Usar

1. Execute o `PrintAgent.exe`.
2. Ele ficará rodando em segundo plano (ícone na bandeja do sistema/system tray).
3. Acesse o sistema web, vá em Configurações > Impressão Local.
4. Configure as impressoras desejadas.
5. O agente receberá os pedidos automaticamente na porta 17321.
