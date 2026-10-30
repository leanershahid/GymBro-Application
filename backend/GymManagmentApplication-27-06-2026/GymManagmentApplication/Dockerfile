FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["GymManagmentApplication/GymManagmentApplication.csproj", "GymManagmentApplication/"]
RUN dotnet restore "GymManagmentApplication/GymManagmentApplication.csproj"
COPY . .
WORKDIR /src/GymManagmentApplication
RUN dotnet publish "GymManagmentApplication.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
# Run as the image's unprivileged 'app' user; only the local-uploads folder needs to be writable.
RUN mkdir -p /app/wwwroot/uploads && chown -R app:app /app/wwwroot
USER app
ENTRYPOINT ["dotnet", "GymManagmentApplication.dll"]
