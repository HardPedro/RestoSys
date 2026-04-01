using System;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Drawing.Printing;
using System.Collections.Generic;

namespace PrintAgent
{
    public class HttpServer
    {
        private HttpListener listener;
        private bool isRunning;
        private PrintManager printManager;

        public HttpServer()
        {
            listener = new HttpListener();
            listener.Prefixes.Add("http://localhost:17321/");
            printManager = new PrintManager();
        }

        public void Start()
        {
            listener.Start();
            isRunning = true;
            Task.Run(() => HandleRequests());
        }

        public void Stop()
        {
            isRunning = false;
            listener.Stop();
        }

        private async Task HandleRequests()
        {
            while (isRunning)
            {
                try
                {
                    var context = await listener.GetContextAsync();
                    var request = context.Request;
                    var response = context.Response;

                    // CORS
                    response.AppendHeader("Access-Control-Allow-Origin", "*");
                    response.AppendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                    response.AppendHeader("Access-Control-Allow-Headers", "Content-Type");

                    if (request.HttpMethod == "OPTIONS")
                    {
                        response.StatusCode = 200;
                        response.Close();
                        continue;
                    }

                    string responseString = "";
                    byte[] buffer = null;

                    if (request.HttpMethod == "GET" && request.Url.AbsolutePath == "/health")
                    {
                        responseString = "{\"status\":\"online\"}";
                        response.ContentType = "application/json";
                    }
                    else if (request.HttpMethod == "GET" && request.Url.AbsolutePath == "/printers")
                    {
                        var printers = new List<string>();
                        foreach (string printer in PrinterSettings.InstalledPrinters)
                        {
                            printers.Add(printer);
                        }
                        responseString = JsonSerializer.Serialize(printers);
                        response.ContentType = "application/json";
                    }
                    else if (request.HttpMethod == "POST" && request.Url.AbsolutePath == "/config")
                    {
                        using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
                        {
                            string json = await reader.ReadToEndAsync();
                            File.WriteAllText("config.json", json);
                            printManager.LoadConfig();
                            responseString = "{\"status\":\"success\"}";
                        }
                    }
                    else if (request.HttpMethod == "POST" && request.Url.AbsolutePath == "/print")
                    {
                        using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
                        {
                            string json = await reader.ReadToEndAsync();
                            var printReq = JsonSerializer.Deserialize<PrintRequest>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                            printManager.Enqueue(printReq);
                            responseString = "{\"status\":\"queued\"}";
                        }
                    }
                    else
                    {
                        response.StatusCode = 404;
                    }

                    if (!string.IsNullOrEmpty(responseString))
                    {
                        buffer = Encoding.UTF8.GetBytes(responseString);
                        response.ContentLength64 = buffer.Length;
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                    
                    response.Close();
                }
                catch (Exception ex)
                {
                    Console.WriteLine(ex.Message);
                }
            }
        }
    }
}
