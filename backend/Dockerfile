FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests -B && \
    mv target/backend-0.0.1-SNAPSHOT.jar target/app.jar && \
    java -Djarmode=tools -jar target/app.jar extract --destination /app/extracted

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/extracted/ ./
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-XX:+UseSerialGC", "-XX:TieredStopAtLevel=1", "-jar", "app.jar"]
