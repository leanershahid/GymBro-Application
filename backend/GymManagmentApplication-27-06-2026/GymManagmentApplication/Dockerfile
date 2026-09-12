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
ENTRYPOINT ["dotnet", "GymManagmentApplication.dll"]
