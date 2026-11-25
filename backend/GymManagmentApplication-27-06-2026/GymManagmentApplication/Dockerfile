FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["GymManagmentApplication/GymManagmentApplication.csproj", "GymManagmentApplication/"]
# linux-x64: only the Linux native ONNX Runtime libraries (local face matching) end up in the image.
RUN dotnet restore "GymManagmentApplication/GymManagmentApplication.csproj" -r linux-x64
COPY . .
WORKDIR /src/GymManagmentApplication
RUN dotnet publish "GymManagmentApplication.csproj" -c Release -r linux-x64 --self-contained false -o /app/publish /p:UseAppHost=false

# Debian-based runtime image: glibc + libstdc++, which libonnxruntime.so (FaceAiSharp face matching) needs.
# Don't switch to the -alpine (musl) or -chiseled variants without checking ONNX Runtime still loads.
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
# Run as the image's unprivileged 'app' user; only the local-uploads folder needs to be writable.
RUN mkdir -p /app/wwwroot/uploads && chown -R app:app /app/wwwroot
USER app
ENTRYPOINT ["dotnet", "GymManagmentApplication.dll"]
